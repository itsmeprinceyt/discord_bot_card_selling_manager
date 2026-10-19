import { ONE_HOUR, FIVE_MINUTES, ONE_MINUTE } from "../utils/TTL.util";
import { getDBName } from "../utils/ValueFetcher/getDBName.util";
import { getProduction } from "../utils/ValueFetcher/getProduction.util";
import { getRedis } from "../lib/Redis/redis.config";

/**
 * @brief Shape of every cache entry descriptor.
 */
export interface RedisKeyEntry {
  redis_key: string;
  redis_ttl: number;
}

/**
 * @brief Centralized Redis key + TTL builder.
 *
 * @description
 * Every Redis entry the app writes should get its key and TTL from here
 * so namespacing and expiration stay consistent and auditable.
 *
 * To add a new cache entry:
 *   1. Add a `static` factory method below returning `RedisKeyEntry`.
 *   2. If it's a global key (not per-user/per-account), add it to `allKeys()`.
 *   3. If it's scoped (user/account), add a matching invalidation helper.
 */
export class RedisKeyService {
  /* ────────────────────── global keys ────────────────────── */

  static heartbeat(): RedisKeyEntry {
    const env = getProduction();
    const dbName = getDBName();
    return {
      redis_key: `${dbName}:heartbeat_last_check:${env}`,
      redis_ttl: ONE_HOUR,
    };
  }

  static totalAccounts(): RedisKeyEntry {
    const env = getProduction();
    const dbName = getDBName();
    return {
      redis_key: `${dbName}:total_accounts:${env}`,
      redis_ttl: ONE_HOUR,
    };
  }

  /* ────────────────────── user-scoped keys ────────────────────── */

  static accountsList(userId: string): RedisKeyEntry {
    const env = getProduction();
    const dbName = getDBName();
    return {
      redis_key: `${dbName}:accounts_list:${env}:${userId}`,
      redis_ttl: ONE_HOUR,
    };
  }

  /* ────────────────────── account-scoped keys ────────────────────── */

  static accountOverview(accountId: string): RedisKeyEntry {
    const env = getProduction();
    const dbName = getDBName();
    return {
      redis_key: `${dbName}:account_overview:${env}:${accountId}`,
      redis_ttl: FIVE_MINUTES,
    };
  }

  static buyerSingle(accountId: string, discordId: string): RedisKeyEntry {
    const env = getProduction();
    const dbName = getDBName();
    return {
      redis_key: `${dbName}:buyer_single:${env}:${accountId}:${encodeURIComponent(
        discordId,
      )}`,
      redis_ttl: ONE_MINUTE,
    };
  }

  static buyersList(
    accountId: string,
    page: number,
    search: string,
  ): RedisKeyEntry {
    const env = getProduction();
    const dbName = getDBName();
    const searchPart = search.trim() ? search.trim().toLowerCase() : "all";
    return {
      redis_key: `${dbName}:buyers_list:${env}:${accountId}:p${page}:s${searchPart}`,
      redis_ttl: ONE_MINUTE * 2,
    };
  }

  static cardSingle(accountId: string, cardCode: string): RedisKeyEntry {
    const env = getProduction();
    const dbName = getDBName();
    return {
      redis_key: `${dbName}:card_single:${env}:${accountId}:${encodeURIComponent(
        cardCode.toLowerCase(),
      )}`,
      redis_ttl: ONE_MINUTE,
    };
  }

  /**
   * @brief Optional — audit logs page cache.
   *
   * @description
   * Short TTL because logs append frequently. If you choose not to use
   * this key in the route, it simply never gets written; invalidation
   * helpers below still won't break (DEL on a missing key is a no-op).
   */
  static auditLogs(
    accountId: string,
    page: number,
    action: string | null,
    entityType: string | null,
  ): RedisKeyEntry {
    const env = getProduction();
    const dbName = getDBName();
    const actionPart = action ?? "all";
    const entityPart = entityType ?? "all";
    return {
      redis_key: `${dbName}:audit_logs:${env}:${accountId}:p${page}:a${actionPart}:e${entityPart}`,
      redis_ttl: ONE_MINUTE,
    };
  }

  /* ────────────────────── registry ────────────────────── */

  /**
   * @brief Global cache keys — safe to invalidate en masse.
   *
   * @description
   * Only entries that don't take dynamic args (userId/accountId) can be
   * blindly invalidated by iterating this list. Heartbeat is excluded
   * on purpose — it's a persistent sentinel, not a cache.
   *
   * Scoped keys (accounts_list, buyer_single, card_single, …) are NOT
   * in this list; they get their own invalidation helpers below.
   */
  static allKeys(): RedisKeyEntry[] {
    return [RedisKeyService.totalAccounts()];
  }
}

/* ------------------------------------------------------------------ */
/* Invalidation helpers                                                */
/* ------------------------------------------------------------------ */

/**
 * @brief Invalidates every global cache key registered in `allKeys()`.
 *
 * @description
 * Use after any write that could make global aggregates stale
 * (e.g. creating/deleting an account should bust `total_accounts`).
 */
export async function invalidateAllRedisKeys(): Promise<number> {
  const entries = RedisKeyService.allKeys();
  if (entries.length === 0) return 0;

  const redis = await getRedis();
  const keys = entries.map((e) => e.redis_key);
  const deleted = await redis.del(...keys);
  return typeof deleted === "number" ? deleted : keys.length;
}

/**
 * @brief Invalidates a specific global key by name.
 */
export async function invalidateRedisKey(
  keyName: "heartbeat" | "totalAccounts",
): Promise<number> {
  const entry = RedisKeyService[keyName]();
  const redis = await getRedis();
  const deleted = await redis.del(entry.redis_key);
  return typeof deleted === "number" ? deleted : 0;
}

/**
 * @brief Invalidates a per-user cache key.
 */
export async function invalidateUserRedisKey(
  keyName: "accountsList",
  userId: string,
): Promise<number> {
  const entry = RedisKeyService[keyName](userId);
  const redis = await getRedis();
  const deleted = await redis.del(entry.redis_key);
  return typeof deleted === "number" ? deleted : 0;
}

/**
 * @brief Invalidates all account-scoped caches that don't depend on other
 *        dimensions (overview only).
 *
 * @description
 * Call after renaming / deleting an account. Order/card mutations
 * should use `invalidateOrderMutationCaches` instead — that also busts
 * `buyer_single` + `card_single` which this helper doesn't touch.
 */
export async function invalidateAccountRedisKey(
  accountId: string,
): Promise<number> {
  const redis = await getRedis();
  const keys = [RedisKeyService.accountOverview(accountId).redis_key];
  const deleted = await redis.del(...keys);
  return typeof deleted === "number" ? deleted : keys.length;
}

/**
 * @brief Bust every cache key affected by a single order mutation.
 *
 * @description
 * Use for:
 *   - mark-done / mark-traded / complete / cancel / cancel-first
 *   - undo
 *   - toggle-deleted
 *   - order create (new + reactivated)
 *
 * Busts:
 *   - buyer_single:${acc}:${discordId}
 *   - card_single:${acc}:${cardCode}
 *   - account_overview:${acc}   (stats changed)
 *
 * Safe to call with null/undefined args — missing sides are skipped.
 */
export async function invalidateOrderMutationCaches(
  accountId: string,
  discordId: string | null | undefined,
  cardCode: string | null | undefined,
): Promise<void> {
  const redis = await getRedis();
  const keys: string[] = [RedisKeyService.accountOverview(accountId).redis_key];

  if (discordId && discordId.trim()) {
    keys.push(
      RedisKeyService.buyerSingle(accountId, discordId.trim()).redis_key,
    );
  }
  if (cardCode && cardCode.trim()) {
    keys.push(RedisKeyService.cardSingle(accountId, cardCode.trim()).redis_key);
  }

  try {
    await redis.del(...keys);
  } catch (err) {
    console.error("invalidateOrderMutationCaches failed:", err);
  }
}

/**
 * @brief Bulk variant — bust caches for many buyers + cards in one batch.
 *
 * @description
 * Use for bulk operations like `trade-sheet/mark-done` where multiple
 * orders across different buyers + cards are completed atomically.
 */
export async function invalidateBulkOrderMutationCaches(
  accountId: string,
  discordIds: Iterable<string>,
  cardCodes: Iterable<string>,
): Promise<void> {
  const redis = await getRedis();
  const keys = new Set<string>();

  keys.add(RedisKeyService.accountOverview(accountId).redis_key);

  for (const did of discordIds) {
    if (did && did.trim())
      keys.add(RedisKeyService.buyerSingle(accountId, did.trim()).redis_key);
  }
  for (const code of cardCodes) {
    if (code && code.trim())
      keys.add(RedisKeyService.cardSingle(accountId, code.trim()).redis_key);
  }

  if (keys.size === 0) return;
  try {
    await redis.del(...Array.from(keys));
  } catch (err) {
    console.error("invalidateBulkOrderMutationCaches failed:", err);
  }
}

/**
 * @brief Invalidates a single buyer's cache only.
 *
 * @description
 * Narrow helper for cases where you know only the buyer side changed
 * (e.g. buyer-level update without touching cards). Most mutations
 * should use `invalidateOrderMutationCaches` instead.
 */
export async function invalidateBuyerSingleCache(
  accountId: string,
  discordId: string,
): Promise<number> {
  const { redis_key } = RedisKeyService.buyerSingle(accountId, discordId);
  const redis = await getRedis();
  const deleted = await redis.del(redis_key);
  return typeof deleted === "number" ? deleted : 0;
}
