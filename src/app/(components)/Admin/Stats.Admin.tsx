"use client";

import { useEffect, useState } from "react";
import { Users, ShieldCheck } from "lucide-react";
import axios from "axios";
import getAxiosErrorMessage from "../../../utils/Auth/Auth.AxiosHelper";
import SkeletonBlock from "../SkeletonBlock";

interface Stats {
  users: number;
  admins: number;
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      {/* Icon + label row */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-neutral-800/70" />
        <SkeletonBlock className="h-3 w-20" />
      </div>
      {/* Value */}
      <SkeletonBlock className="mt-3 h-7 w-16" />
    </div>
  );
}

function AdminStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data } = await axios.get("/api/admin/stats", {
          withCredentials: true,
        });

        if (!data.ok) {
          if (!cancelled) setErrored(true);
          return;
        }

        if (!cancelled) {
          setStats({
            users: data.users ?? 0,
            admins: data.admins ?? 0,
          });
        }
      } catch (err) {
        console.error(getAxiosErrorMessage(err, "Failed to load stats"));
        if (!cancelled) setErrored(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <AdminStatsSkeleton />;
  }

  if (errored || !stats) {
    return (
      <div className="rounded-2xl border border-red-900/50 bg-red-950/30 px-5 py-4 text-sm text-red-400">
        Could not load stats.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <StatCard
        icon={<Users className="h-4 w-4" />}
        label="Total users"
        value={stats.users}
      />
      <StatCard
        icon={<ShieldCheck className="h-4 w-4" />}
        label="Admins"
        value={stats.admins}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-center gap-2 text-neutral-500">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-neutral-100">
        {value}
      </p>
    </div>
  );
}
