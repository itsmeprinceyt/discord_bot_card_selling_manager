import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { MyJWT } from "./types/User/JWT.types";
import { rateLimitMiddleware } from "./lib/Redis/rateLimiter.redis";

/* ─────────────────────────────────────────────────────────────────────────────
 * API groups
 *
 * Every /api/* route MUST live under one of these prefixes.
 * Anything else under /api/* is denied by default (typo protection).
 * ────────────────────────────────────────────────────────────────────────────*/

const API_AUTH = "/api/auth"; // public — NextAuth + unlock-style endpoints
const API_PUBLIC = "/api/public"; // public — heartbeat, webhooks, probes
const API_ADMIN = "/api/admin"; // admin only
const API_DASHBOARD = "/api/dashboard"; // any authenticated user

/* ─────────────────────────────────────────────────────────────────────────────
 * Page groups
 * ────────────────────────────────────────────────────────────────────────────*/

const PAGES_PUBLIC = ["/", "/login"] as const;
const PAGES_ADMIN = ["/admin"] as const;
const PAGES_USER = ["/dashboard"] as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * Rate limiting
 *
 * Auth routes are excluded — NextAuth manages its own traffic.
 * Every other /api/* route falls through to the RateLimiter defaults unless
 * an override below matches it first.
 * ────────────────────────────────────────────────────────────────────────────*/

const RATE_LIMIT_EXCLUDED_PREFIXES = [API_AUTH] as const;

interface RateLimitRule {
  prefix: string;
  maxRequests: number;
  windowMs: number;
  blockTimeMs: number;
}

const RATE_LIMIT_RULES: readonly RateLimitRule[] = [
  {
    prefix: API_PUBLIC,
    maxRequests: 60,
    windowMs: 60_000,
    blockTimeMs: 60_000,
  },
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

/* ─────────────────────────────────────────────────────────────────────────────
 * Route classification
 * ────────────────────────────────────────────────────────────────────────────*/

type ApiGroup = "auth" | "public" | "admin" | "dashboard" | "unknown";

function isApi(path: string): boolean {
  return path.startsWith("/api/");
}

function matchesPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(p + "/"));
}

function apiGroup(path: string): ApiGroup {
  if (matchesPrefix(path, [API_AUTH])) return "auth";
  if (matchesPrefix(path, [API_PUBLIC])) return "public";
  if (matchesPrefix(path, [API_ADMIN])) return "admin";
  if (matchesPrefix(path, [API_DASHBOARD])) return "dashboard";
  return "unknown";
}

function shouldRateLimit(path: string): boolean {
  if (!isApi(path)) return false;
  return !matchesPrefix(path, RATE_LIMIT_EXCLUDED_PREFIXES);
}

function rateLimitOverrideFor(path: string): RateLimitRule | undefined {
  return RATE_LIMIT_RULES.find((r) => matchesPrefix(path, [r.prefix]));
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Response helpers
 * ────────────────────────────────────────────────────────────────────────────*/

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

/* ─────────────────────────────────────────────────────────────────────────────
 * API dispatcher
 * ────────────────────────────────────────────────────────────────────────────*/

function handleApi(
  req: NextRequest,
  path: string,
  isLoggedIn: boolean,
  isAdmin: boolean,
  user: MyJWT | null,
): NextResponse {
  switch (apiGroup(path)) {
    case "auth":
    case "public":
      // No auth required.
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

/* ─────────────────────────────────────────────────────────────────────────────
 * Middleware
 * ────────────────────────────────────────────────────────────────────────────*/

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const path = req.nextUrl.pathname;

  // 1. Rate limit — API only, auth excluded.
  if (shouldRateLimit(path)) {
    const rl = await rateLimitMiddleware(req, rateLimitOverrideFor(path));
    if (rl) {
      return new NextResponse(rl.body, {
        status: rl.status,
        headers: rl.headers,
      });
    }
  }

  // 2. Session.
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  });
  const user = (token as MyJWT) ?? null;
  const isLoggedIn = Boolean(user);
  const isAdmin = user?.is_admin === true;

  // 3. Login page — bounce already-authenticated users to their home.
  if (path === "/login") {
    if (!isLoggedIn) return NextResponse.next();

    const url = req.nextUrl.clone();
    url.pathname = isAdmin ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  // 4. API routing.
  if (isApi(path)) {
    return handleApi(req, path, isLoggedIn, isAdmin, user);
  }

  // 5. Page routing.
  if (matchesPrefix(path, PAGES_PUBLIC)) return NextResponse.next();
  if (!isLoggedIn) return respondUnauthorized(req, path);

  if (matchesPrefix(path, PAGES_ADMIN) && !isAdmin) {
    console.warn(`Admin page denied → ${user?.email} → ${path}`);
    return respondForbidden(req, path);
  }

  // PAGES_USER + any other authenticated page → allowed.
  return NextResponse.next();
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Matcher — skip static assets.
 * ────────────────────────────────────────────────────────────────────────────*/

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|eot|txt|xml)$).*)",
  ],
};
