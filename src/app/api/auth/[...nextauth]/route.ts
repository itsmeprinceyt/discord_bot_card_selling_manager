import NextAuth, {
  NextAuthOptions,
  DefaultSession,
  DefaultUser,
} from "next-auth";
import Google, { GoogleProfile } from "next-auth/providers/google";
import { cookies } from "next/headers";
import { initServer, db } from "../../../../lib/Database/main.db";

import type { Pool } from "mysql2/promise";
import { UserRow } from "../../../../types/User/UserRow.type";
import { MyJWT } from "../../../../types/User/JWT.type";
import { getCurrentDateTime } from "../../../../utils/ValueFetcher/getDateTime.util";
import { generateULID } from "../../../../utils/generateULID.util";
import {
  matchInviteCode,
  regenerateInviteCode,
} from "../../../../utils/getInviteCode.util";
import { auditLog } from "../../../../services/AuditLog.service";

/* -------------------------------------------------------------------------- */
/*  Environment                                                               */
/* -------------------------------------------------------------------------- */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

/* -------------------------------------------------------------------------- */
/*  Database pool (lazy, module-scoped singleton)                             */
/* -------------------------------------------------------------------------- */

let pool: Pool | null = null;

/**
 * Lazily initializes and returns the MySQL connection pool.
 * Safe to call repeatedly — the pool is created once per process.
 */
async function getPool(): Promise<Pool> {
  if (!pool) {
    await initServer();
    pool = db();
  }
  return pool;
}

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Trims a value to a string and enforces a maximum length.
 * Returns an empty string for non-string inputs.
 */
function sanitizeString(value: unknown, maxLen = 255): string {
  if (typeof value !== "string") return "";
  const s = value.trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/** Basic RFC-5322-ish email shape check. */
function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/* -------------------------------------------------------------------------- */
/*  NextAuth module augmentation                                              */
/* -------------------------------------------------------------------------- */

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string;
      email?: string;
      image?: string | null;
      is_admin?: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id?: string;
    name?: string;
    email?: string;
    image?: string | null;
    is_admin?: boolean;
  }
}

/* -------------------------------------------------------------------------- */
/*  NextAuth options                                                          */
/* -------------------------------------------------------------------------- */

const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 24 * 30, // 30 days
  },

  providers: [
    Google({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    /**
     * ## `signIn` callback
     *
     * Runs **before** a session is created. Returns `false` to reject the
     * whole flow with `AccessDenied`.
     *
     * ### Rules
     *
     * | User type     | Cookie state            | Result                                     |
     * |---------------|-------------------------|--------------------------------------------|
     * | Existing user | (any)                   | Logged in — no code required               |
     * | Existing user | env `SECRET_LOGIN_CODE` | Logged in, promoted to `is_admin = TRUE`   |
     * | New user      | env `SECRET_LOGIN_CODE` | Created with `is_admin = TRUE`             |
     * | New user      | DB invite code          | Created normally, code rotates afterwards  |
     * | New user      | none / invalid          | **Rejected**                               |
     *
     * ### Side effects
     *
     * - Deletes `login_code` cookie on success.
     * - Rotates the DB `invite_code` **only** after a DB-code signup.
     * - Never rotates the env secret (it's immutable at runtime).
     * - Writes to `audit_logs` **only on successful new-user registration**.
     *   Normal logins and rejected signup attempts are NOT audited to
     *   avoid log spam.
     */
    async signIn({ profile }) {
      const pool = await getPool();
      const cookieStore = await cookies();

      /* ---- 1. Validate Google profile --------------------------------- */
      const now = getCurrentDateTime();
      const googleProfile = profile as GoogleProfile;

      if (!googleProfile.email) return false;

      const email = sanitizeString(googleProfile.email, 320);
      if (!isValidEmail(email)) return false;

      const name = sanitizeString(googleProfile.name ?? "", 255);
      const image = sanitizeString(googleProfile.picture ?? "", 500);
      const googleId = sanitizeString(googleProfile.sub ?? "", 255);

      if (!googleId) return false;

      /* ---- 2. Validate the login code ------------------------------- */
      const loginCode = cookieStore.get("login_code")?.value;

      // Env code takes priority over DB code inside matchInviteCode:
      //   "secret" → admin signup path
      //   "db"     → normal signup path (code rotates afterwards)
      //   null     → only existing users may pass
      const match = loginCode ? await matchInviteCode(loginCode) : null;

      const usingSecretCode = match === "secret";
      const usingDbCode = match === "db";

      try {
        /* ---- 3. Does the user already exist? ------------------------ */
        const [rows] = await pool.execute<UserRow[]>(
          "SELECT id, is_admin FROM users WHERE email = ? OR google_id = ?",
          [email, googleId],
        );

        const userExists = Array.isArray(rows) && rows.length > 0;

        /* ---- 3a. Existing user → log in, NO audit log --------------- */
        if (userExists) {
          if (usingSecretCode) {
            await pool.execute(
              `UPDATE users
               SET name = ?, image = ?, google_id = ?, is_admin = TRUE
               WHERE email = ?`,
              [name, image, googleId, email],
            );
          } else {
            await pool.execute(
              `UPDATE users
               SET name = ?, image = ?, google_id = ?
               WHERE email = ?`,
              [name, image, googleId, email],
            );
          }

          if (loginCode) cookieStore.delete("login_code");
          return true;
        }

        /* ---- 3b. New user → must have a valid code ------------------ */
        if (!usingSecretCode && !usingDbCode) {
          console.log("Signup rejected: no valid invite code");
          // NO audit log here — would spam on every random attempt.
          return false;
        }

        /* ---- 3c. Create the new user -------------------------------- */
        const newId = generateULID({
          prefix: "user",
          separator: "_",
          maxLength: 40,
        });

        await pool.execute(
          `INSERT INTO users (id, google_id, email, name, image, is_admin, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newId, googleId, email, name, image, usingSecretCode, now],
        );

        /* ---- 3d. Rotate the DB invite code (single-use semantics) --- */
        // Only rotate when the signup came through the DB code.
        // The env SECRET_LOGIN_CODE is immutable at runtime.
        let rotationSucceeded: boolean | null = null;
        if (usingDbCode) {
          const regenerated = await regenerateInviteCode();
          rotationSucceeded = Boolean(regenerated);
          if (regenerated) {
            console.log(`Invite code regenerated after signup: ${regenerated}`);
          } else {
            console.warn(
              "Invite code regeneration failed — old code may still be valid",
            );
          }
        }

        // Consume the cookie so it can't be replayed.
        cookieStore.delete("login_code");

        /* ---- Audit: new-user registration (ONLY SUCCESS) ------------ */
        let signupDescription: string;
        if (usingSecretCode) {
          signupDescription =
            `New user registered via Google OAuth using SECRET_LOGIN_CODE ` +
            `(env secret) — created as admin. ` +
            `[email=${email}]`;
        } else {
          signupDescription =
            `New user registered via Google OAuth using a DB invite code — ` +
            `created as normal user. ` +
            `Invite code rotation ${rotationSucceeded ? "succeeded" : "FAILED — old code may still be valid"}. ` +
            `[email=${email}]`;
        }

        await auditLog.log(pool, {
          userId: newId,
          action: "CREATE",
          entityType: "USER",
          description: signupDescription,
        });

        return true;
      } catch (error: unknown) {
        console.error("SignIn error:", error);
        // NO audit log here — DB errors are already logged to stderr.
        return false;
      }
    },

    /**
     * ## `jwt` callback
     *
     * Runs whenever a JWT is created or read. We re-hydrate the token from
     * the DB on `signIn` and on explicit `update` triggers, so admin status
     * changes are picked up without requiring a re-login.
     */
    async jwt({ token, user, account, profile, trigger }) {
      const t = token as MyJWT;
      const pool = await getPool();

      let emailToCheck: string | null = null;

      if (account?.provider === "google" && profile) {
        const googleProfile = profile as GoogleProfile;
        emailToCheck = googleProfile.email ?? null;
      }

      if (user?.email) {
        emailToCheck = user.email;
      }

      if (trigger === "update" && t.email) {
        emailToCheck = t.email;
      }

      if (emailToCheck) {
        const [rows] = await pool.execute<UserRow[]>(
          "SELECT id, name, email, image, is_admin FROM users WHERE email = ?",
          [emailToCheck],
        );

        if (Array.isArray(rows) && rows.length > 0) {
          const dbUser = rows[0];

          t.id = dbUser.id ?? t.id;
          t.name = dbUser.name ?? "";
          t.email = dbUser.email ?? emailToCheck;
          t.image = dbUser.image ?? "";
          t.is_admin = Boolean(dbUser.is_admin);
        }
      }

      return t;
    },

    /**
     * ## `session` callback
     *
     * Copies the fields we care about from the JWT onto the client-visible
     * session object.
     */
    async session({ session, token }) {
      const t = token as MyJWT;

      if (session.user) {
        session.user.id = t.id;
        session.user.name = t.name;
        session.user.email = t.email;
        session.user.image = t.image;
        session.user.is_admin = Boolean(t.is_admin);
      }

      return session;
    },

    /**
     * ## `redirect` callback
     *
     * Keeps same-origin redirects intact; everything else goes to
     * `/dashboard`.
     */
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      return baseUrl + "/dashboard";
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
export { authOptions };
