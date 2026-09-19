import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { MyJWT } from "./types/User/JWT.type";
import { rateLimitMiddleware } from "./lib/Redis/rateLimiter.redis";

// ─── API Groups ──────────────────────────────────────────────────────────────
// Every /api/* route MUST live under one of these prefixes.
// Anything else under /api/* is denied by default (typo protection).

const API_AUTH = "/api/auth"; // public (NextAuth + unlock-style endpoints)
const API_ADMIN = "/api/admin"; // admin only
const API_DASHBOARD = "/api/dashboard"; // any logged-in user

// ─── Page Groups ─────────────────────────────────────────────────────────────

const PAGES_PUBLIC = ["/", "/login"] as const;
const PAGES_ADMIN = ["/admin"] as const;
const PAGES_USER = ["/dashboard"] as const;

// ─── Rate Limit Rules ────────────────────────────────────────────────────────

/** Auth routes: excluded — NextAuth manages its own traffic. */
const RATE_LIMIT_EXCLUDED_PREFIXES = [API_AUTH] as const;

/**
 * Per-group rate-limit overrides.
 * `auth` is excluded above; only admin + dashboard get rules.
 * Falls back to RateLimiter defaults for anything unmatched.
 */
const RATE_LIMIT_RULES: Array<{
  prefix: string;
  maxRequests: number;
  windowMs: number;
  blockTimeMs: number;
}> = [
  {
    prefix: API_ADMIN,
    maxRequests: 100,
    windowMs: 60_000,
    blockTimeMs: 5 * 60_000,
  },
  {
    prefix: API_DASHBOARD,
    maxRequests: 250,
    windowMs: 60_000,
    blockTimeMs: 5 * 60_000,
  },
];

// ─── Route Classification ────────────────────────────────────────────────────

type ApiGroup = "auth" | "admin" | "dashboard" | "unknown";

function apiGroup(path: string): ApiGroup {
  if (path === API_AUTH || path.startsWith(API_AUTH + "/")) return "auth";
  if (path === API_ADMIN || path.startsWith(API_ADMIN + "/")) return "admin";
  if (path === API_DASHBOARD || path.startsWith(API_DASHBOARD + "/"))
    return "dashboard";
  return "unknown";
}

function isApi(path: string): boolean {
  return path.startsWith("/api/");
}

function matchesPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(p + "/"));
}

function shouldRateLimit(path: string): boolean {
  if (!isApi(path)) return false;
  return !matchesPrefix(path, RATE_LIMIT_EXCLUDED_PREFIXES);
}

function rateLimitOverrideFor(path: string) {
  return RATE_LIMIT_RULES.find((r) => matchesPrefix(path, [r.prefix]));
}

// ─── Response Helpers ────────────────────────────────────────────────────────

function respondUnauthorized(req: NextRequest, path: string): NextResponse {
  if (isApi(path)) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set(
    "callbackUrl",
    req.nextUrl.pathname + req.nextUrl.search,
  );
  return NextResponse.redirect(url);
}

function respondForbidden(req: NextRequest, path: string): NextResponse {
  if (isApi(path)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/";
  return NextResponse.redirect(url);
}

// ─── API Handler ─────────────────────────────────────────────────────────────

function handleApi(
  req: NextRequest,
  path: string,
  isLoggedIn: boolean,
  isAdmin: boolean,
  user: MyJWT | null,
): NextResponse {
  const group = apiGroup(path);

  switch (group) {
    case "auth":
      // Public. (NextAuth, unlock, etc.)
      return NextResponse.next();

    case "admin":
      if (!isLoggedIn) return respondUnauthorized(req, path);
      if (!isAdmin) {
        console.warn(`Admin API denied → ${user?.email} → ${path}`);
        return respondForbidden(req, path);
      }
      return NextResponse.next();

    case "dashboard":
      if (!isLoggedIn) return respondUnauthorized(req, path);
      return NextResponse.next();

    case "unknown":
    default:
      // Misrouted API — fail loudly rather than silently allow.
      console.warn(`Unknown API route hit: ${path}`);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

// ─── Middleware ──────────────────────────────────────────────────────────────

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const path = req.nextUrl.pathname;

  /* ── 1. Rate limit (API only, auth excluded) ─────────────────────────── */
  if (shouldRateLimit(path)) {
    const rl = await rateLimitMiddleware(req, rateLimitOverrideFor(path));
    if (rl) {
      return new NextResponse(rl.body, {
        status: rl.status,
        headers: rl.headers,
      });
    }
  }

  /* ── 2. Session ──────────────────────────────────────────────────────── */
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  });
  const user = (token as MyJWT) ?? null;
  const isLoggedIn = Boolean(user);
  const isAdmin = user?.is_admin === true;

  /* ── 3. Login page special case ─────────────────────────────────────── */
  if (path === "/login") {
    if (!isLoggedIn) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = isAdmin ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  /* ── 4. API routing ──────────────────────────────────────────────────── */
  if (isApi(path)) {
    return handleApi(req, path, isLoggedIn, isAdmin, user);
  }

  /* ── 5. Page routing ─────────────────────────────────────────────────── */
  if (matchesPrefix(path, PAGES_PUBLIC)) return NextResponse.next();
  if (!isLoggedIn) return respondUnauthorized(req, path);
  if (matchesPrefix(path, PAGES_ADMIN) && !isAdmin) {
    console.warn(`Admin page denied → ${user?.email} → ${path}`);
    return respondForbidden(req, path);
  }
  // USER_PAGES + any other page → allowed if logged in
  return NextResponse.next();
}

// ─── Matcher ─────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|eot|txt|xml)$).*)",
  ],
};
