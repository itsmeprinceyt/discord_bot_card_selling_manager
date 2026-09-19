/**
 * formatDateTime.util.ts
 *
 * Single source of truth for rendering dates across the app.
 *
 * Handles every shape that can reach us:
 *   - ISO strings from JSON (mysql2 returns DATETIME columns as JS Date,
 *     which NextResponse JSON.stringify's into `2025-01-15T10:23:45.000Z`)
 *   - Raw MySQL strings (`2025-01-15 10:23:45`) — when `dateStrings: true`
 *     is enabled on the pool, or when reading from a raw query cache
 *   - JS `Date` objects (defensive — e.g. if you ever call this on the server
 *     before JSON serialization)
 *   - `null` / `undefined` / garbage → returns a fallback string
 *
 * All output is rendered in the **local** timezone of whatever environment
 * runs it (browser for client components, server for server components).
 */

export type DateTimeFormat =
  | "datetime" // 2025-01-15 10:23
  | "datetime-sec" // 2025-01-15 10:23:45
  | "date" // 2025-01-15
  | "time" // 10:23
  | "time-sec" // 10:23:45
  | "relative" // 3m ago, 2h ago, 5d ago, 2025-01-15
  | "iso" // 2025-01-15T10:23:45.000Z
  | "long"; // Jan 15, 2025, 10:23 AM

export interface FormatDateTimeOptions {
  /** Default: "datetime" */
  format?: DateTimeFormat;
  /** Shown when the input is null/undefined/invalid. Default: "—" */
  fallback?: string;
  /** For "relative": max age (ms) before falling back to absolute date. Default: 30 days. */
  relativeMaxMs?: number;
}

/* -------------------------------------------------------------------------- */
/*  Core: coerce anything into a valid Date (or null)                         */
/* -------------------------------------------------------------------------- */

/**
 * Best-effort parse of any date-like value into a `Date`.
 * Returns `null` if the value cannot be interpreted.
 */
export function toDate(
  value: string | number | Date | null | undefined,
): Date | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value !== "string") return null;

  const s = value.trim();
  if (!s) return null;

  // Already ISO-ish (has "T" or ends with "Z" or has offset).
  if (s.includes("T") || s.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // MySQL-style "YYYY-MM-DD HH:MM:SS" (or with fractional seconds).
  // Interpret as *local* time of the runtime (matches mysql2's default
  // behavior when the pool doesn't set `timezone`).
  const mysqlLike = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/.test(s);
  if (mysqlLike) {
    const [datePart, timePart = "00:00:00"] = s.split(" ");
    const [y, mo, d] = datePart.split("-").map(Number);
    const [h = 0, mi = 0, sec = 0] = timePart.split(":").map(Number);
    const date = new Date(y, mo - 1, d, h, mi, Math.floor(sec));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Final fallback — let the runtime try.
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* -------------------------------------------------------------------------- */
/*  Main formatter                                                            */
/* -------------------------------------------------------------------------- */

export function formatDateTime(
  value: string | number | Date | null | undefined,
  options: FormatDateTimeOptions = {},
): string {
  const { format = "datetime", fallback = "—", relativeMaxMs } = options;

  const d = toDate(value);
  if (!d) return fallback;

  switch (format) {
    case "iso":
      return d.toISOString();

    case "date":
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    case "time":
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;

    case "time-sec":
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    case "datetime-sec":
      return (
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      );

    case "long":
      return d.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

    case "relative":
      return formatRelative(d, relativeMaxMs ?? 30 * 24 * 60 * 60 * 1000);

    case "datetime":
    default:
      return (
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}`
      );
  }
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatRelative(d: Date, maxMs: number): string {
  const now = Date.now();
  const diff = now - d.getTime();

  // Future timestamps → show absolute (avoids "in -3m ago" weirdness).
  if (diff < 0) {
    return formatDateTime(d, { format: "datetime" });
  }

  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;

  // Beyond the max window → absolute date.
  if (diff > maxMs) {
    return formatDateTime(d, { format: "date" });
  }

  return `${Math.floor(diff / 86_400_000)}d ago`;
}
