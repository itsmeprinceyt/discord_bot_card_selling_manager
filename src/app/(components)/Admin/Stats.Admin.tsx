"use client";

import { useEffect, useState } from "react";
import { Users, ShieldCheck, LayoutDashboard, Loader2 } from "lucide-react";

interface Stats {
  users: number;
  admins: number;
  accounts: number;
}

export default function AdminStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.ok) {
          if (!cancelled) setErrored(true);
          return;
        }

        if (!cancelled) {
          setStats({
            users: data.users ?? 0,
            admins: data.admins ?? 0,
            accounts: data.accounts ?? 0,
          });
        }
      } catch {
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
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex h-26 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900"
          >
            <Loader2 className="h-4 w-4 animate-spin text-neutral-600" />
          </div>
        ))}
      </div>
    );
  }

  if (errored || !stats) {
    return (
      <div className="rounded-2xl border border-red-900/50 bg-red-950/30 px-5 py-4 text-sm text-red-400">
        Could not load stats.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
      <StatCard
        icon={<LayoutDashboard className="h-4 w-4" />}
        label="Accounts"
        value={stats.accounts}
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
