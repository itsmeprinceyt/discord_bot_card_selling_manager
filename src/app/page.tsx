import Link from "next/link";
import { ArrowRight, Database } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900">
            <Database size={20} className="text-neutral-300" />
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight text-white">
            Discord Bot Card Selling Manager
          </h1>
          <p className="text-sm text-neutral-500 mt-3 leading-relaxed">
            A manual organization system for
            <br /> Discord in-game bot cards.
          </p>
        </div>

        {/* Primary CTA */}
        <Link
          href="/login"
          className="group flex items-center justify-center gap-2 rounded-xl bg-white text-neutral-900 font-medium text-sm py-3 transition-colors duration-200 hover:bg-neutral-100 active:scale-[0.985]"
        >
          Let&apos;s go
          <ArrowRight
            size={16}
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </Link>

        {/* Footer */}
        <p className="text-xs text-neutral-600 text-center mt-8">
          <Link
            href="/policy/privacy"
            className="transition hover:text-neutral-300"
          >
            Privacy Policy
          </Link>{" "}
          <span className="text-neutral-800">|</span>{" "}
          <Link
            href="/policy/terms-and-condition"
            className="transition hover:text-neutral-300"
          >
            Terms and Condition
          </Link>
        </p>
      </div>
    </main>
  );
}
