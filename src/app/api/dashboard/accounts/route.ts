import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getPool } from "../../../../lib/Database/main.db";
import { generateULID } from "../../../../utils/generateULID.util";

import {
  GameType,
  GAME_LABEL,
} from "../../../../utils/Dashboard/accountLabels";
import {
  invalidateRedisKey,
  invalidateUserRedisKey,
  RedisKeyService,
} from "../../../../services/RedisKey.service";
import { getRedis } from "../../../../lib/Redis/redis.config";

interface AccountRow extends RowDataPacket {
  id: string;
  name: string;
  game_type: GameType;
  created_at: string;
  pending_count: number;
}

interface IdRow extends RowDataPacket {
  id: string;
}

interface AccountListItem {
  id: string;
  name: string;
  game_type: GameType;
  created_at: string;
  pending_count: number;
}

/* --------------------------------- GET --------------------------------- */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    const { redis_key: accountsListKey, redis_ttl: accountsListTtl } =
      RedisKeyService.accountsList(userId);

    const redis = getRedis();

    // ── Cache read (skipped when force-refreshing) ──────────────────────
    if (!forceRefresh) {
      try {
        // `get` returns unknown without a type param. We store JSON, so treat
        // the raw value as string and parse manually for determinism.
        const cached = await redis.get<string>(accountsListKey);
        if (cached) {
          const parsed =
            typeof cached === "string"
              ? (JSON.parse(cached) as AccountListItem[])
              : (cached as AccountListItem[]);
          return NextResponse.json({ ok: true, accounts: parsed });
        }
      } catch (cacheErr) {
        console.error("GET /api/accounts cache read failed:", cacheErr);
      }
    } else {
      // Bust the key so concurrent readers don't get served a stale value
      // while our fresh DB query is in flight.
      try {
        await invalidateUserRedisKey("accountsList", userId);
      } catch (cacheErr) {
        console.error("GET /api/accounts cache bust failed:", cacheErr);
      }
    }

    // ── Cache miss (or forced) → hit DB ─────────────────────────────────
    const pool = await getPool();
    const [rows] = await pool.execute<AccountRow[]>(
      `SELECT a.id,
              a.name,
              a.game_type,
              a.created_at,
              COALESCE(p.pending_count, 0) AS pending_count
         FROM accounts a
         LEFT JOIN (
           SELECT account_id, COUNT(*) AS pending_count
             FROM orders
            WHERE status = 'WAITING' AND deleted = FALSE
            GROUP BY account_id
         ) p ON p.account_id = a.id
        WHERE a.user_id = ?
        ORDER BY a.name ASC`,
      [userId],
    );

    const accounts: AccountListItem[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      game_type: r.game_type,
      created_at: r.created_at,
      pending_count: Number(r.pending_count),
    }));

    // ── Cache write (always, including after a forced refresh) ──────────
    try {
      // @upstash/redis: `set(key, value, { ex })` — 3 args max.
      await redis.set(accountsListKey, JSON.stringify(accounts), {
        ex: accountsListTtl,
      });
    } catch (cacheErr) {
      console.error("GET /api/accounts cache write failed:", cacheErr);
    }

    return NextResponse.json({ ok: true, accounts });
  } catch (err) {
    console.error("GET /api/accounts failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch accounts" },
      { status: 500 },
    );
  }
}

/* --------------------------------- POST -------------------------------- */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const gameType = String(body?.game_type ?? "").trim() as GameType;

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Account name is required" },
        { status: 400 },
      );
    }
    if (name.length > 255) {
      return NextResponse.json(
        { ok: false, error: "Account name is too long" },
        { status: 400 },
      );
    }

    if (!Object.keys(GAME_LABEL).includes(gameType)) {
      return NextResponse.json(
        { ok: false, error: "Invalid game type" },
        { status: 400 },
      );
    }

    const pool = await getPool();

    const [existing] = await pool.execute<IdRow[]>(
      "SELECT id FROM accounts WHERE name = ? AND user_id = ? LIMIT 1",
      [name, userId],
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: "You already have an account with this name" },
        { status: 400 },
      );
    }

    const accountId = generateULID({
      prefix: "acc",
      separator: "_",
      maxLength: 40,
    });

    await pool.execute(
      "INSERT INTO accounts (id, name, user_id, game_type) VALUES (?, ?, ?, ?)",
      [accountId, name, userId, gameType],
    );

    await pool.execute(
      `INSERT INTO audit_logs (id, user_id, account_id, action, entity_type, description)
       VALUES (?, ?, ?, 'CREATE', 'ACCOUNT', ?)`,
      [
        generateULID({ prefix: "log", separator: "_", maxLength: 40 }),
        userId,
        accountId,
        `Account "${name}" (${gameType}) created`,
      ],
    );

    // Bust caches affected by account creation.
    try {
      await invalidateRedisKey("totalAccounts");
      await invalidateUserRedisKey("accountsList", userId);
    } catch (cacheErr) {
      console.error("POST /api/accounts cache invalidate failed:", cacheErr);
    }

    return NextResponse.json({
      ok: true,
      account: { id: accountId, name, game_type: gameType },
    });
  } catch (err) {
    console.error("POST /api/accounts failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to create account" },
      { status: 500 },
    );
  }
}
