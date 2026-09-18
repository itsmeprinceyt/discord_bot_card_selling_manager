import Link from "next/link";
import { Home, FileQuestion, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900">
            <FileQuestion className="h-5 w-5 text-neutral-400" />
          </div>
          <h1 className="text-5xl font-semibold tracking-tight text-neutral-100">
            404
          </h1>
          <p className="text-sm text-neutral-400 mt-3">
            This page doesn&apos;t exist or has been moved.
          </p>
        </div>

        {/* Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-white text-neutral-900 font-medium text-sm py-2.5 transition hover:bg-neutral-200"
            >
              <Home className="h-4 w-4" />
              Go home
            </Link>

            <Link
              href="/dashboard"
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-200 font-medium text-sm py-2.5 transition hover:border-neutral-700 hover:bg-neutral-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
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
