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
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900">
            <LayoutDashboard className="h-5 w-5 text-neutral-400" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hi, {firstName}
          </h1>
          <p className="text-sm text-neutral-400 mt-2">
            {session.user.is_admin
              ? "You're signed in as an admin."
              : "Welcome to your dashboard."}
          </p>
        </div>

        {/* Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt={session.user.name ?? "User avatar"}
              className="mx-auto h-16 w-16 rounded-full border border-neutral-800"
            />
          ) : (
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 text-lg font-medium text-neutral-300">
              {firstName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="mt-4 text-center">
            <p className="text-sm font-medium text-neutral-100">
              {session.user.name}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {session.user.email}
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-neutral-600 text-center mt-6">
          Discord Bot Card Selling Manager
        </p>
      </div>
    </main>
  );
}
