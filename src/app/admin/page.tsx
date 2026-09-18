import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../api/auth/[...nextauth]/route";

import {
  ShieldCheck,
  KeyRound,
  LayoutDashboard,
  ChevronRight,
} from "lucide-react";
import AdminStats from "../(components)/Admin/Stats.Admin";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) redirect("/login");
  if (!session.user.is_admin) redirect("/dashboard");

  const name = session.user.name ?? "Admin";
  const firstName = name.split(" ")[0];

  const links = [
    {
      href: "/admin/invite-code",
      icon: KeyRound,
      title: "Invite Code",
      desc: "View, refresh, or set a custom invite code.",
    },
    {
      href: "/dashboard",
      icon: LayoutDashboard,
      title: "Your Dashboard",
      desc: "Go to your personal dashboard.",
    },
  ];

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-16">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Admin Panel
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              Welcome back, {firstName}.
            </p>
          </div>
        </div>

        {/* Stats — fetched from /api/admin/stats */}
        <div className="mb-6">
          <AdminStats />
        </div>

        {/* Quick links */}
        <div className="space-y-3">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-900 px-5 py-4 transition hover:border-neutral-700 hover:bg-neutral-900/80"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 text-neutral-400 group-hover:text-neutral-200">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-100">
                    {link.title}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">{link.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-600 group-hover:text-neutral-400" />
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <p className="text-xs text-neutral-600 text-center mt-10">
          Signed in as {session.user.email}
        </p>
      </div>
    </main>
  );
}
