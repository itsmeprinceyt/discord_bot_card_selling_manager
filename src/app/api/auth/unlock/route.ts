import { NextResponse } from "next/server";
import { matchInviteCode } from "../../../../utils/getInviteCode.util";

/**
 * ## `POST /api/auth/unlock`
 *
 * Validates a user-entered invite code against both sources
 * (env secret first, then DB row) using {@link matchInviteCode}.
 *
 * On success, sets an **HTTP-only** `login_code` cookie with a short TTL.
 * The NextAuth `signIn` callback later re-validates this cookie before
 * letting the user through.
 *
 * ### Flow
 *
 * ```text
 *   Login page           /api/auth/unlock             signIn callback
 *   ──────────           ─────────────────             ───────────────
 *   user types code  ──▶  matchInviteCode(code)  ──▶   reads cookie
 *                         ├─ match → set cookie        ├─ match → allow
 *                         └─ no    → 401               └─ no    → reject
 * ```
 *
 * ### Request body
 *
 * ```json
 * { "code": "inv_01HX7Z..." }
 * ```
 *
 * ### Responses
 *
 * | Status | Body                                  | Meaning                     |
 * |--------|---------------------------------------|-----------------------------|
 * | 200    | `{ ok: true }` + cookie               | Code accepted               |
 * | 400    | `{ ok: false }`                       | Malformed request body      |
 * | 401    | `{ ok: false, error: "Invalid code" }`| Code did not match anything |
 *
 * ### Cookie
 *
 * - Name: `login_code`
 * - `httpOnly: true` — not readable by client JS
 * - `sameSite: "lax"`
 * - `secure: true` in production
 * - `maxAge: 600` (10 minutes) — plenty for the Google OAuth round-trip
 */
export async function POST(req: Request) {
  try {
    const { code } = await req.json();

    if (typeof code !== "string" || !code) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const match = await matchInviteCode(code);

    if (!match) {
      return NextResponse.json(
        { ok: false, error: "Invalid code" },
        { status: 401 },
      );
    }

    const res = NextResponse.json({ ok: true });

    res.cookies.set("login_code", code, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10, // 10 minutes
    });

    return res;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

/**
 * ## `GET /api/auth/unlock`
 *
 * Reports whether the caller currently holds a still-valid `login_code`
 * cookie. Used by the login page on mount so a returning user doesn't have
 * to re-enter the code within the 10-minute window.
 *
 * ### Responses
 *
 * | Status | Body                          | Meaning                          |
 * |--------|-------------------------------|----------------------------------|
 * | 200    | `{ unlocked: true }`          | Cookie present and still valid   |
 * | 200    | `{ unlocked: false }`         | No cookie, or it no longer match |
 *
 * ### Why a GET
 *
 * No side effects, no body, safe to call on every mount. Doesn't rotate
 * anything or consume the cookie — the actual consumption happens in the
 * NextAuth `signIn` callback.
 */
export async function GET() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const loginCode = cookieStore.get("login_code")?.value;

  if (!loginCode) {
    return NextResponse.json({ unlocked: false });
  }

  const match = await matchInviteCode(loginCode);

  return NextResponse.json({ unlocked: match !== null });
}
