import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Terms and conditions for Discord Bot Card Selling Manager.",
};

export default function TermsPage() {
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
            <FileText size={20} className="text-neutral-300" />
          </div>
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-white">
              Terms &amp; Conditions
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
              These terms govern your use of Discord Bot Card Selling Manager.
              By signing in, you agree to them. If you disagree with any part,
              please don&apos;t use the platform.
            </p>

            <Section number={1} title="Acceptance of Terms">
              <p>
                By accessing or using Discord Bot Card Selling Manager, you
                confirm that you have read, understood, and agreed to these
                Terms &amp; Conditions in full.
              </p>
            </Section>

            <Section number={2} title="Invite-Only Access">
              <p>
                Access is restricted to users who hold a valid invite code.
                Codes are personal and must not be publicly shared. Anyone who
                redeems a shared code outside its intended recipient may have
                their access revoked. Codes are single-use and expire shortly
                after they&apos;re entered.
              </p>
            </Section>

            <Section number={3} title="User Responsibilities">
              <ul className="space-y-1.5 pl-4 list-disc marker:text-neutral-700">
                <li>
                  <strong className="text-neutral-300">Accurate data</strong> —
                  enter only information you&apos;re authorised to manage (your
                  own game accounts, buyers you&apos;ve verified).
                </li>
                <li>
                  <strong className="text-neutral-300">
                    No sensitive content
                  </strong>{" "}
                  — do not enter sexually explicit, violent, hateful, or
                  discriminatory content in any field (account names, buyer
                  notes, card descriptions, etc.).
                </li>
                <li>
                  <strong className="text-neutral-300">
                    No malicious input
                  </strong>{" "}
                  — sharing harmful links, scam content, or illegal material
                  will result in immediate removal.
                </li>
                <li>
                  <strong className="text-neutral-300">
                    Professional use only
                  </strong>{" "}
                  — this tool is for managing card inventory, not for spam,
                  harassment, or unrelated activity.
                </li>
              </ul>
            </Section>

            <Section number={4} title="User Conduct">
              <p>The following is strictly prohibited:</p>
              <ul className="space-y-1.5 pl-4 list-disc marker:text-neutral-700">
                <li>Using the platform for illegal or unauthorised purposes</li>
                <li>Impersonating other users or misrepresenting identity</li>
                <li>
                  Attempting to access other users&apos; accounts or data
                  without permission
                </li>
                <li>
                  Exploiting vulnerabilities, scraping, or automating requests
                  beyond normal use
                </li>
                <li>
                  Reselling, redistributing, or reverse-engineering the platform
                </li>
              </ul>
            </Section>

            <Section number={5} title="Game Account &amp; Card Data">
              <p>
                You are solely responsible for the accuracy and legality of the
                game accounts, Discord IDs, card codes, and trade information
                you enter. We do not verify game account ownership, card
                authenticity, or Discord identity. We are not affiliated with
                any game, bot, or Discord server whose data you may reference
                here.
              </p>
            </Section>

            <Section number={6} title="Content Moderation &amp; Audit Logs">
              <p>
                Actions performed on the platform are recorded in an audit log
                for moderation, security, and troubleshooting. We reserve the
                right to review this data and to remove content or suspend
                accounts that violate these terms. Admin accounts may inspect
                platform activity to enforce these rules.
              </p>
            </Section>

            <Section number={7} title="Account Actions">
              <p>
                We may suspend or permanently terminate accounts that engage in
                violations — including posting harmful content, abusing invite
                codes, attempting unauthorised access, or engaging in spam or
                disruptive behaviour. Termination is at our discretion and may
                occur without prior notice.
              </p>
            </Section>

            <Section number={8} title="Privacy &amp; Data">
              <p>
                Your privacy matters. Our{" "}
                <Link
                  href="/policy/privacy"
                  className="text-neutral-300 underline underline-offset-2 hover:text-white"
                >
                  Privacy Policy
                </Link>{" "}
                explains exactly what we collect, how we use it, and your
                rights. By using the platform, you consent to those practices.
              </p>
            </Section>

            <Section number={9} title="Limitation of Liability">
              <p>
                Discord Bot Card Selling Manager is provided &quot;as is&quot;,
                without warranty of any kind. We are not liable for in-game
                suspensions, lost trades, missed orders, incorrect card data, or
                any indirect or consequential damages arising from your use of
                the platform. You use the tool at your own risk.
              </p>
            </Section>

            <Section number={10} title="Terms Updates">
              <p>
                These terms may change from time to time. When they do, we
                update the &quot;Last updated&quot; date at the top of this
                page. Continued use of the platform after a change means you
                accept the revised terms.
              </p>
            </Section>

            <Section number={11} title="Contact">
              <p>
                Questions about these terms? Reach out through the same channel
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
