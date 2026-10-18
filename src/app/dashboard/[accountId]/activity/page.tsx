"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Activity, Filter } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import CustomLoader from "../../../(components)/CustomLoader";
import getAxiosErrorMessage from "../../../../utils/Auth/Auth.AxiosHelper";
import { AuditLogSinglelClient } from "../../../../types/AuditLog/auditLog.types";
import { formatDateTime } from "../../../../utils/Formator/formatDateTime.util";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  UPDATE: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  DELETE: "text-red-400 bg-red-500/10 border-red-500/20",
  ORDER_CREATED: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  ORDER_COMPLETED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  ORDER_CANCELLED: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  CARD_TRADED: "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

export default function ActivityPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.accountId as string;

  const [logs, setLogs] = useState<AuditLogSinglelClient[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/dashboard/accounts/${accountId}/activity?page=${page}`;
      if (actionFilter) url += `&action=${actionFilter}`;
      if (entityFilter) url += `&entity_type=${entityFilter}`;

      const { data } = await axios.get(url, { withCredentials: true });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Failed to fetch activity"));
    } finally {
      setLoading(false);
    }
  }, [accountId, page, actionFilter, entityFilter]);

  useEffect(() => {
    const load = () => {
      fetchLogs();
    };
    load();
  }, [fetchLogs]);

  if (loading && logs.length === 0) return <CustomLoader />;

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-16 text-neutral-100">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push(`/dashboard/${accountId}`)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Activity Logs
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Review all account changes and actions
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex items-center gap-2 flex-1">
            <Filter size={16} className="text-neutral-500 shrink-0" />
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-600 cursor-pointer"
            >
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="ORDER_CREATED">Order Created</option>
              <option value="ORDER_COMPLETED">Order Completed</option>
              <option value="ORDER_CANCELLED">Order Cancelled</option>
              <option value="CARD_TRADED">Card Traded</option>
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-600 cursor-pointer"
            >
              <option value="">All Entities</option>
              <option value="ORDER">Order</option>
              <option value="CARD">Card</option>
              <option value="BUYER">Buyer</option>
              <option value="ACCOUNT">Account</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-neutral-500 mb-4">
          {total} activity records found
        </div>

        {/* Timeline List */}
        {logs.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-sm text-neutral-500">
            No activity logs found for this account.
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const actionColor =
                ACTION_COLORS[log.action] ||
                "text-neutral-400 bg-neutral-800 border-neutral-700";
              return (
                <div
                  key={log.id}
                  className="flex gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-neutral-700"
                >
                  <div className="mt-1 shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 border border-neutral-800">
                      <Activity size={14} className="text-neutral-400" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider ${actionColor}`}
                      >
                        {log.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                        {log.entity_type}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-200 leading-relaxed">
                      {log.description}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
                      <span>{formatDateTime(log.created_at)}</span>
                      {log.user_name && (
                        <>
                          <span>•</span>
                          <span>by {log.user_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 disabled:opacity-40 hover:bg-neutral-800 transition cursor-pointer"
            >
              Prev
            </button>
            <span className="text-sm text-neutral-500">
              Page {page} of {pages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= pages}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 disabled:opacity-40 hover:bg-neutral-800 transition cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
