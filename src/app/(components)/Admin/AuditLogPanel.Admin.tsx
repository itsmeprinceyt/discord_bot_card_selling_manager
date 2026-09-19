"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ScrollText,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { formatDateTime } from "../../../utils/Formator/formatDateTime.util";

const PAGE_SIZE = 20;

interface AuditLog {
  id: string;
  user_id: string | null;
  account_id: string | null;
  action: string;
  entity_type: string;
  description: string;
  created_at: string;
}

export default function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/audit-logs?page=${p}&limit=${PAGE_SIZE}`,
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setError("Failed to load audit logs");
        return;
      }

      setLogs(data.logs ?? []);
      setPage(data.page ?? p);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadd = () => {
      load(1);
    };
    loadd();
  }, [load]);

  return (
    <div className="w-full max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900">
          <ScrollText className="h-5 w-5 text-neutral-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-neutral-100">Audit Logs</h2>
          <p className="text-sm text-neutral-400">
            Recent system activity, newest first.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(page)}
          disabled={loading}
          title="Refresh"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-400 transition hover:border-neutral-700 hover:text-neutral-200 disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Card */}
      <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-lg">
        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 border-b border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Body */}
        {loading && logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
            <p className="text-xs text-neutral-500">Loading…</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <ScrollText className="h-6 w-6 text-neutral-600" />
            <p className="text-sm text-neutral-500">No audit logs yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {logs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </ul>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between border-t border-neutral-800 px-4 py-3">
            <p className="text-xs text-neutral-500">
              Page <span className="text-neutral-300">{page}</span> of{" "}
              <span className="text-neutral-300">{totalPages}</span>
              <span className="mx-2 text-neutral-700">·</span>
              {total} total
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => load(page - 1)}
                disabled={loading || page <= 1}
                className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-900 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <button
                type="button"
                onClick={() => load(page + 1)}
                disabled={loading || page >= totalPages}
                className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-900 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Row                                                                */
/* ------------------------------------------------------------------ */

function LogRow({ log }: { log: AuditLog }) {
  return (
    <li className="px-4 py-3.5 transition hover:bg-neutral-950/50">
      {/* Top line: badges + time */}
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <ActionBadge action={log.action} />
        <EntityBadge entity={log.entity_type} />
        <span className="ml-auto text-xs text-neutral-500">
          {formatDateTime(log.created_at)}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed text-neutral-200">
        {log.description}
      </p>

      {/* Meta */}
      {(log.user_id || log.account_id) && (
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
          {log.user_id && (
            <span>
              user:{" "}
              <span className="font-mono text-neutral-400">{log.user_id}</span>
            </span>
          )}
          {log.account_id && (
            <span>
              account:{" "}
              <span className="font-mono text-neutral-400">
                {log.account_id}
              </span>
            </span>
          )}
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Badges                                                             */
/* ------------------------------------------------------------------ */

function ActionBadge({ action }: { action: string }) {
  const tone = actionTone(action);
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {action}
    </span>
  );
}

function EntityBadge({ entity }: { entity: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-neutral-400">
      {entity}
    </span>
  );
}

function actionTone(action: string): string {
  switch (action) {
    case "CREATE":
      return "border-emerald-900/60 bg-emerald-950/40 text-emerald-400";
    case "UPDATE":
      return "border-sky-900/60 bg-sky-950/40 text-sky-400";
    case "DELETE":
    case "CARD_CANCELLED":
    case "ORDER_CANCELLED":
      return "border-red-900/60 bg-red-950/40 text-red-400";
    case "LOGIN":
    case "LOGOUT":
      return "border-violet-900/60 bg-violet-950/40 text-violet-400";
    case "INVITE_USED":
    case "ROLE_CHANGED":
      return "border-amber-900/60 bg-amber-950/40 text-amber-400";
    case "CARD_TRADED":
    case "ORDER_COMPLETED":
      return "border-teal-900/60 bg-teal-950/40 text-teal-400";
    case "ORDER_CREATED":
      return "border-indigo-900/60 bg-indigo-950/40 text-indigo-400";
    default:
      return "border-neutral-800 bg-neutral-950 text-neutral-400";
  }
}
