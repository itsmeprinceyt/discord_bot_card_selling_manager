import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { ShieldCheck } from "lucide-react";
import AdminStats from "../(components)/Admin/Stats.Admin";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) redirect("/login");
  if (!session.user.is_admin) redirect("/dashboard");

  const name = session.user.name ?? "Admin";

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-16">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900">
            <ShieldCheck size={20} className="" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Admin Panel
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              Welcome back, {name}.
            </p>
          </div>
        </div>

        <AdminStats />
      </div>
    </main>
  );
}
