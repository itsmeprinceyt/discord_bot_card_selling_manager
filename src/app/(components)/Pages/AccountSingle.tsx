"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  LayoutDashboard,
  CreditCard,
  ArrowLeft,
  FileSpreadsheet,
  UploadCloud,
  Search,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import getAxiosErrorMessage from "../../../utils/Auth/Auth.AxiosHelper";
import {
  AccountSingleType,
  StatsSingle,
} from "../../../types/AccountSingle.types";
import SkeletonBlock from "../SkeletonBlock";

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

function AccountSingleSkeleton() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-16">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-neutral-800/70" />
          <div className="flex-1 min-w-0 space-y-2">
            <SkeletonBlock className="h-7 w-48 max-w-full" />
            <SkeletonBlock className="h-3 w-20" />
          </div>
          <div className="h-7 w-24 shrink-0 animate-pulse rounded-lg bg-neutral-800/70" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 min-h-28 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <SkeletonBlock className="h-3 w-20" />
                <SkeletonBlock className="h-2.5 w-12" />
              </div>
              <SkeletonBlock className="h-7 w-16" />
            </div>
          ))}
        </div>

        {/* Info banner */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 flex items-start gap-4">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-neutral-800/70" />
          <div className="flex-1 space-y-2 pt-1">
            <SkeletonBlock className="h-4 w-56 max-w-full" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-3/4" />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="my-8">
          <SkeletonBlock className="mb-4 h-3 w-28" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="h-10 w-10 animate-pulse rounded-lg bg-neutral-800/70" />
                <div className="w-full space-y-1.5">
                  <SkeletonBlock className="h-3.5 w-24" />
                  <SkeletonBlock className="h-3 w-32 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AccountSingle({ accountId }: { accountId: string }) {
  const router = useRouter();

  const [account, setAccount] = useState<AccountSingleType | null>(null);
  const [stats, setStats] = useState<StatsSingle | null>(null);
  const [isWarnIncoming, setIsWarnIncoming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  /* -------------------- fetch data -------------------- */
  const fetchData = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError("");
      try {
        const { data } = await axios.get(
          `/api/dashboard/accounts/${accountId}`,
          {
            withCredentials: true,
            params: forceRefresh ? { refresh: "true" } : undefined,
          },
        );

        setAccount(data.account);
        setStats(data.stats);
        setIsWarnIncoming(Boolean(data.isWarnIncoming));
      } catch (err) {
        setError(getAxiosErrorMessage(err, "Failed to load dashboard"));
      } finally {
        setLoading(false);
      }
    },
    [accountId],
  );

  useEffect(() => {
    const load = () => {
      fetchData();
    };
    load();
  }, [fetchData]);

  /* -------------------- refresh -------------------- */
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      // Keep the current UI visible while re-fetching (don't flip `loading`).
      setError("");
      const { data } = await axios.get(`/api/dashboard/accounts/${accountId}`, {
        withCredentials: true,
        params: { refresh: "true" },
      });
      setAccount(data.account);
      setStats(data.stats);
      setIsWarnIncoming(Boolean(data.isWarnIncoming));
    } catch (err) {
      setError(getAxiosErrorMessage(err, "Failed to refresh dashboard"));
    } finally {
      setRefreshing(false);
    }
  }, [accountId, refreshing]);

  if (loading) return <AccountSingleSkeleton />;
  if (error && !account)
    return (
      <main className="min-h-screen bg-neutral-950 p-8 text-red-400">
        {error}
      </main>
    );
  if (!account || !stats) return null;

  const quickLinks = [
    {
      href: `/dashboard/${accountId}/trade-sheet`,
      label: "Trade Sheet",
      desc: "Manage active trades",
      icon: FileSpreadsheet,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      href: `/dashboard/${accountId}/cards`,
      label: "Cards",
      desc: "Search & manage cards",
      icon: CreditCard,
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    },
    {
      href: `/dashboard/${accountId}/buyers`,
      label: "Buyers",
      desc: "Lookup buyer queues",
      icon: Search,
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    },
    {
      href: `/dashboard/${accountId}/bulk-import`,
      label: "Bulk Import",
      desc: "Import multiple orders",
      icon: UploadCloud,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
  ];

  // Split long labels into main label + period sublabel so the card stays
  // compact and the typography reads cleanly regardless of column width.
  const statCards: {
    key: string;
    label: string;
    sublabel: string | null;
    value: number;
  }[] = [
    {
      key: "active-buyers",
      label: "Active Buyers",
      sublabel: null,
      value: stats.activeBuyers,
    },
    {
      key: "cards-to-sell",
      label: "Cards to Sell",
      sublabel: null,
      value: stats.totalCards,
    },
    {
      key: "completed-today",
      label: "Completed",
      sublabel: "Today",
      value: stats.completedToday,
    },
    {
      key: "completed-30d",
      label: "Completed",
      sublabel: "Last 30 days",
      value: stats.completedLast30Days,
    },
  ];

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-16">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push(`/dashboard`)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {account.name}
            </h1>
            <p className="text-xs text-neutral-500 mt-1">{account.game_type}</p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-400 transition hover:border-neutral-700 hover:text-neutral-200 disabled:opacity-50"
            aria-label="Refresh dashboard"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {/* Warning banner — only when completed orders are still not deleted */}
        {isWarnIncoming && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-400" />
            <p className="leading-relaxed">
              One or more completed cards have not been deleted from Discord.
              Please check the{" "}
              <Link
                href={`/dashboard/${accountId}/completed`}
                className="font-semibold text-red-200 underline underline-offset-2 hover:text-white transition"
              >
                completed page
              </Link>{" "}
              and delete them from Discord to avoid a possible server warn.
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card) => (
            <div
              key={card.key}
              className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 min-h-28 flex flex-col justify-between"
            >
              {/* Label block — top */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider leading-tight truncate">
                    {card.label}
                  </p>
                </div>
                {card.sublabel && (
                  <p className="text-[10px] text-neutral-600 font-medium uppercase tracking-wider leading-tight truncate">
                    {card.sublabel}
                  </p>
                )}
              </div>

              {/* Value block — bottom */}
              <p className="text-3xl font-bold text-white tabular-nums leading-none">
                {card.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Optional info banner */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-neutral-400">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-200">
              Welcome to your dashboard
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              Use the quick actions above or the sidebar to manage cards,
              buyers, and orders.
            </p>
          </div>
        </div>

        {/* Quick Actions / Button Chips */}
        <div className="my-8">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex flex-col items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-neutral-700 hover:bg-neutral-800/50"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border ${link.color}`}
                  >
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-200 group-hover:text-white transition">
                      {link.label}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {link.desc}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
