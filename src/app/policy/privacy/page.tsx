import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Discord Bot Card Selling Manager.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-16">
      <div className="mx-auto w-full max-w-2xl">
        {/* Back */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-xs text-neutral-500 transition hover:text-neutral-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>

        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900">
            <ShieldCheck className="h-5 w-5 text-neutral-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-sm text-neutral-500 mt-1">Last updated: —</p>
          </div>
        </div>

        {/* Content */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-lg">
          <p className="text-sm text-neutral-500">
            This page is intentionally left blank.
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-neutral-600 text-center mt-10">
          Discord Bot Card Selling Manager
        </p>
      </div>
    </main>
  );
}
