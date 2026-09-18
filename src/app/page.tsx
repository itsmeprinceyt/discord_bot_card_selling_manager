import Link from "next/link";
import { Construction, LayoutDashboard, LogIn } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900">
            <Construction className="h-5 w-5 text-neutral-400" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Discord Bot Card Selling Manager
          </h1>
          <p className="text-sm text-neutral-400 mt-2">
            A manual organization system for Discord in-game bot cards.
          </p>
        </div>

        {/* Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
          {/* WIP badge */}
          <div className="mb-5 flex items-center justify-center gap-2 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs font-medium text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            Work in progress
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Link
              href="/login"
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-white text-neutral-900 font-medium text-sm py-2.5 transition hover:bg-neutral-200"
            >
              <LogIn className="h-4 w-4" />
              Sign in
            </Link>

            <Link
              href="/dashboard"
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-200 font-medium text-sm py-2.5 transition hover:border-neutral-700 hover:bg-neutral-900"
            >
              <LayoutDashboard className="h-4 w-4" />
              Go to dashboard
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-neutral-600 text-center mt-6">
          Access is invite-only ·{" "}
          <Link
            href="/policy/privacy"
            className="transition hover:text-neutral-400"
          >
            Privacy
          </Link>{" "}
          ·{" "}
          <Link
            href="/policy/terms-and-condition"
            className="transition hover:text-neutral-400"
          >
            Terms
          </Link>
        </p>
      </div>
    </main>
  );
}
