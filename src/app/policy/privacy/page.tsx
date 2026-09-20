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
          <ArrowLeft size={14} />
          Back
        </Link>

        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900">
            <ShieldCheck size={20} className="text-neutral-300" />
          </div>
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-white">
              Privacy Policy
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Last updated: September 20, 2026
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 sm:p-8">
          <div className="space-y-7">
            <p className="text-sm text-neutral-400 leading-relaxed">
              Discord Bot Card Selling Manager is a small, invite-only tool for
              tracking in-game bot cards, buyers, and trade queues across
              Discord. This policy explains exactly what we store, why we store
              it, and what we don&apos;t touch.
            </p>

            <Section number={1} title="Information We Collect">
              <p>We only store what the platform needs to function:</p>
              <ul className="space-y-1.5 pl-4 list-disc marker:text-neutral-700">
                <li>
                  <strong className="text-neutral-300">
                    Google account data
                  </strong>{" "}
                  — your email address, display name, profile image, and Google
                  account ID, provided by Google when you sign in via OAuth.
                </li>
                <li>
                  <strong className="text-neutral-300">
                    Game account names
                  </strong>{" "}
                  — the labels you create for your SOFI or KARUTA accounts.
                </li>
                <li>
                  <strong className="text-neutral-300">Discord IDs</strong> —
                  the Discord user IDs of buyers you register on your accounts.
                </li>
                <li>
                  <strong className="text-neutral-300">
                    Card &amp; order data
                  </strong>{" "}
                  — card codes, price tiers, currency types, order queues, and
                  trade records you enter.
                </li>
                <li>
                  <strong className="text-neutral-300">IP address</strong> —
                  processed temporarily for rate limiting and abuse prevention.
                  Not retained long-term.
                </li>
                <li>
                  <strong className="text-neutral-300">Audit logs</strong> — a
                  record of actions (creates, updates, deletes, logins) tied to
                  your account, kept for moderation and traceability.
                </li>
              </ul>
            </Section>

            <Section number={2} title="How We Use Your Information">
              <ul className="space-y-1.5 pl-4 list-disc marker:text-neutral-700">
                <li>
                  <strong className="text-neutral-300">
                    Email &amp; Google ID
                  </strong>{" "}
                  — authentication via Google OAuth and account identification.
                </li>
                <li>
                  <strong className="text-neutral-300">Game data</strong> —
                  powering the dashboard, card tracking, and trade queue
                  features you use.
                </li>
                <li>
                  <strong className="text-neutral-300">Discord IDs</strong> —
                  linking orders and buyers to the correct Discord user so you
                  can fulfill trades.
                </li>
                <li>
                  <strong className="text-neutral-300">IP address</strong> —
                  applied transiently by our Redis-backed rate limiter to
                  prevent abuse.
                </li>
                <li>
                  <strong className="text-neutral-300">Audit logs</strong> —
                  maintaining an internal trail for security, debugging, and
                  moderation.
                </li>
              </ul>
            </Section>

            <Section number={3} title="What We Don't Collect">
              <ul className="space-y-1.5 pl-4 list-disc marker:text-neutral-700">
                <li>
                  Passwords — sign-in happens entirely through Google OAuth
                </li>
                <li>Payment information or card details</li>
                <li>Physical addresses or location data</li>
                <li>
                  Browsing history, third-party tracking cookies, or analytics
                </li>
                <li>Any content from Discord servers you belong to</li>
              </ul>
            </Section>

            <Section number={4} title="Third-Party Services">
              <p>
                We rely on a small set of infrastructure providers to run the
                service:
              </p>
              <ul className="space-y-1.5 pl-4 list-disc marker:text-neutral-700">
                <li>
                  <strong className="text-neutral-300">Google</strong> — OAuth
                  authentication
                </li>
                <li>
                  <strong className="text-neutral-300">Upstash Redis</strong> —
                  rate limiting and connection health checks
                </li>
                <li>
                  <strong className="text-neutral-300">
                    Managed MySQL host
                  </strong>{" "}
                  — encrypted storage of your account data
                </li>
                <li>
                  <strong className="text-neutral-300">Vercel</strong> —
                  application hosting
                </li>
              </ul>
              <p>
                We do not sell, rent, or share your information with advertisers
                or data brokers. Ever.
              </p>
            </Section>

            <Section number={5} title="Data Security">
              <p>
                All traffic is served over HTTPS. Your account is authenticated
                through Google OAuth — we never see or store your Google
                password. Database access is restricted, and audit logs help us
                detect unusual activity. IP addresses used for rate limiting are
                processed transiently and expire automatically.
              </p>
            </Section>

            <Section number={6} title="Data Retention">
              <p>
                Account data is retained for as long as your account remains
                active. If you delete your account, your user record, game
                accounts, buyers, cards, orders, and audit entries are removed
                via cascading deletes. Rate-limit keys in Redis expire on short
                TTLs and are not archived.
              </p>
            </Section>

            <Section number={7} title="Your Rights">
              <ul className="space-y-1.5 pl-4 list-disc marker:text-neutral-700">
                <li>Request a copy of the data we store about you</li>
                <li>Request deletion of your account and all linked data</li>
                <li>Update your display name or profile image via Google</li>
                <li>Ask questions about how your data is handled</li>
              </ul>
            </Section>

            <Section number={8} title="Changes to This Policy">
              <p>
                If we ever change how data is handled, we&apos;ll update the
                &quot;Last updated&quot; date at the top of this page. Given the
                project&apos;s minimal-data philosophy, meaningful changes are
                unlikely.
              </p>
            </Section>

            <Section number={9} title="Contact">
              <p>
                Questions or data requests? Reach out through the same channel
                where you received your invite code, or contact the project
                maintainer directly.
              </p>
            </Section>
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-neutral-600 text-center mt-10">
          Discord Bot Card Selling Manager
        </p>
      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2.5 text-sm font-semibold text-white">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-neutral-800 text-[10px] font-medium text-neutral-400">
          {number}
        </span>
        {title}
      </h2>
      <div className="pl-7.5 space-y-2 text-sm text-neutral-400 leading-relaxed">
        {children}
      </div>
    </section>
  );
}
