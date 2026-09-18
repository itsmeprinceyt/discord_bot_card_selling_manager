import NextAuth, {
  NextAuthOptions,
  DefaultSession,
  DefaultUser,
} from "next-auth";
import Google, { GoogleProfile } from "next-auth/providers/google";
import { cookies } from "next/headers";
import { initServer, db } from "../../../../lib/Database/initializeMainServer";

import type { Pool } from "mysql2/promise";
import { UserRow } from "../../../../types/User/UserRow.type";
import { MyJWT } from "../../../../types/User/JWT.type";
import { getCurrentDateTime } from "../../../../utils/ValueFetcher/getDateTime.util";
import { generateULID } from "../../../../utils/generateULID.util";
import {
  getValidInviteCode,
  regenerateInviteCode,
} from "../../../../utils/getInviteCode.util";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const SECRET_LOGIN_CODE = process.env.SECRET_LOGIN_CODE!;

let pool: Pool | null = null;
async function getPool(): Promise<Pool> {
  if (!pool) {
    await initServer();
    pool = db();
  }
  return pool;
}

function sanitizeString(value: unknown, maxLen = 255): string {
  if (typeof value !== "string") return "";
  const s = value.trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

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

const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 24 * 30,
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
    async signIn({ profile }) {
      const pool = await getPool();
      const cookieStore = await cookies();

      // ---- 1. Validate Google profile ----
      const now = getCurrentDateTime();
      const googleProfile = profile as GoogleProfile;

      if (!googleProfile.email) return false;

      const email = sanitizeString(googleProfile.email, 320);
      if (!isValidEmail(email)) return false;

      const name = sanitizeString(googleProfile.name ?? "", 255);
      const image = sanitizeString(googleProfile.picture ?? "", 500);
      const googleId = sanitizeString(googleProfile.sub ?? "", 255);

      if (!googleId) return false;

      const loginCode = cookieStore.get("login_code")?.value;
      const usingSecretCode =
        Boolean(SECRET_LOGIN_CODE) && loginCode === SECRET_LOGIN_CODE;

      try {
        // ---- 2. Does the user already exist? ----
        const [rows] = await pool.execute<UserRow[]>(
          "SELECT id, is_admin FROM users WHERE email = ? OR google_id = ?",
          [email, googleId],
        );

        const userExists = Array.isArray(rows) && rows.length > 0;

        // ---- 3a. Existing user → log in, no code required ----
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

        // ---- 3b. New user → code is mandatory ----
        if (!loginCode) {
          console.log("Signup rejected: no login_code cookie");
          return false;
        }

        if (!usingSecretCode) {
          const validCode = await getValidInviteCode();

          if (!validCode) {
            console.log("Signup rejected: no invite code configured");
            return false;
          }

          if (loginCode !== validCode) {
            console.log("Signup rejected: login code does not match");
            return false;
          }
        }

        // ---- 3c. Create the new user ----
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

        // ---- 3d. Rotate the invite code so it can't be reused ----
        // Only rotate if the signup came via the DB invite code.
        // Env SECRET_LOGIN_CODE can't be regenerated, so skip.
        if (!usingSecretCode) {
          const regenerated = await regenerateInviteCode();
          if (regenerated) {
            console.log(`Invite code regenerated after signup: ${regenerated}`);
          } else {
            console.warn(
              "Invite code regeneration failed — old code may still be valid",
            );
          }
        }

        // Consume the cookie so it can't be reused
        cookieStore.delete("login_code");

        return true;
      } catch (error: unknown) {
        console.error("SignIn error:", error);
        return false;
      }
    },

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

    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      return baseUrl + "/dashboard";
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
export { authOptions };
