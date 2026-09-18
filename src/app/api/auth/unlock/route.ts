import { NextResponse } from "next/server";
import { getValidInviteCode } from "../../../../utils/getInviteCode.util";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const loginCode = cookieStore.get("login_code")?.value;

  if (!loginCode) return NextResponse.json({ unlocked: false });

  const validCode = await getValidInviteCode();
  const unlocked = Boolean(validCode && loginCode === validCode);

  return NextResponse.json({ unlocked });
}

export async function POST(req: Request) {
  try {
    const { code } = await req.json();

    if (typeof code !== "string" || !code) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const validCode = await getValidInviteCode();

    if (!validCode) {
      return NextResponse.json(
        { ok: false, error: "Invite code not set" },
        { status: 500 },
      );
    }

    if (code !== validCode) {
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
      maxAge: 60 * 10,
    });

    return res;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
