"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  CheckCircle,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import getAxiosErrorMessage from "../../../utils/Auth/Auth.AxiosHelper"; // Apna path check kar lena
import CustomLoader from "../../(components)/CustomLoader"; // Apna path check kar lena
import {
  AccountSingleType,
  StatsSingle,
} from "../../../types/AccountSingle.types";

export default function AccountSingle({ accountId }: { accountId: string }) {
  const router = useRouter();

  const [account, setAccount] = useState<AccountSingleType | null>(null);
  const [stats, setStats] = useState<StatsSingle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* -------------------- fetch data -------------------- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(`/api/dashboard/accounts/${accountId}`, {
        withCredentials: true,
      });

      setAccount(data.account);
      setStats(data.stats);
    } catch (err) {
      setError(getAxiosErrorMessage(err, "Failed to load dashboard"));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    const load = () => {
      fetchData();
    };
    load();
  }, [fetchData]);

  if (loading) return <CustomLoader />;
  if (error)
    return (
      <main className="min-h-screen bg-neutral-950 p-8 text-red-400">
        {error}
      </main>
    );
  if (!account || !stats) return null;

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
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {account.name}
            </h1>
            <p className="text-xs text-neutral-500 mt-1">{account.game_type}</p>
          </div>
        </div>

        {/* Optional info banner */}
        <div className="my-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-neutral-400">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-200">
              Welcome to your dashboard
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              Use the sidebar to manage cards, buyers, and orders. Need to
              import multiple orders? Head over to the Bulk Import section.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Buyers */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
                <Users size={20} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">
                {stats.activeBuyers}
              </p>
              <p className="text-xs text-neutral-500 mt-1 font-medium uppercase tracking-wider">
                Active Buyers
              </p>
            </div>
          </div>

          {/* Total Cards */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                <CreditCard size={20} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">
                {stats.totalCards}
              </p>
              <p className="text-xs text-neutral-500 mt-1 font-medium uppercase tracking-wider">
                Total Cards
              </p>
            </div>
          </div>

          {/* Completed Today */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                <CheckCircle size={20} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">
                {stats.completedToday}
              </p>
              <p className="text-xs text-neutral-500 mt-1 font-medium uppercase tracking-wider">
                Completed Today
              </p>
            </div>
          </div>

          {/* Completed Last 30 Days */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                <Clock size={20} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">
                {stats.completedLast30Days}
              </p>
              <p className="text-xs text-neutral-500 mt-1 font-medium uppercase tracking-wider">
                Last 30 Days
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
