import { ulid, monotonicFactory } from "ulid";

const ULID_LENGTH = 26;
const monotonicULID = monotonicFactory();

export interface GenerateULIDOptions {
  /** Prefix like "USR", "ACC", "ORD". Optional. */
  prefix?: string;
  /** Max total length of the returned string. Default 40. */
  maxLength?: number;
  /** Separator between prefix and ULID. Default "_". Use "" for none. */
  separator?: string;
  /**
   * Use monotonic ULIDs (guaranteed sortable when generated
   * multiple times in the same millisecond). Default false.
   */
  monotonic?: boolean;
}

/**
 * Generate a ULID, optionally prefixed.
 *
 * The ULID itself is always kept intact (26 chars).
 * If prefix + separator + ULID exceeds `maxLength`,
 * the prefix is truncated from the left-most side first.
 */
export function generateULID(
  prefixOrOptions: string | GenerateULIDOptions = "",
  maxLength = 40,
  separator = "_",
): string {
  let prefix: string;
  let max: number;
  let sep: string;
  let useMonotonic: boolean;

  // Allow both `generateULID("USR")` and `generateULID({ prefix: "USR" })`
  if (typeof prefixOrOptions === "string") {
    prefix = prefixOrOptions;
    max = maxLength;
    sep = separator;
    useMonotonic = false;
  } else {
    prefix = prefixOrOptions.prefix ?? "";
    max = prefixOrOptions.maxLength ?? 40;
    sep = prefixOrOptions.separator ?? "_";
    useMonotonic = prefixOrOptions.monotonic ?? false;
  }

  const id = useMonotonic ? monotonicULID() : ulid();

  // No prefix — return ULID (truncated if the caller wants it shorter).
  if (!prefix) {
    return id.slice(0, max);
  }

  const availableForPrefix = max - ULID_LENGTH - sep.length;

  // Not enough room for a prefix + ULID — fall back to bare ULID.
  if (availableForPrefix <= 0) {
    return id.slice(0, max);
  }

  const truncatedPrefix =
    prefix.length > availableForPrefix
      ? prefix.slice(0, availableForPrefix)
      : prefix;

  const result = `${truncatedPrefix}${sep}${id}`;

  // Safety net — never exceed max, even if something above misbehaves.
  return result.length > max ? result.slice(0, max) : result;
}
