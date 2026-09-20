import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const name = session.user.name ?? "there";
  const firstName = name.split(" ")[0];

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-16">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900">
            <LayoutDashboard size={20} className="text-neutral-300" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Hi, {firstName}
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              {session.user.is_admin
                ? "You're signed in as an admin."
                : "Welcome to your dashboard."}
            </p>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <p className="text-sm text-neutral-500">
            Nothing here yet — check back soon.
          </p>
        </div>
      </div>
    </main>
  );
}
