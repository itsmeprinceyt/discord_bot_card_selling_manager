"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import {
  KeyRound,
  LogIn,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Check,
} from "lucide-react";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();

  // Check on mount whether the login_code cookie is still valid
  useEffect(() => {
    fetch("/api/auth/unlock")
      .then((r) => r.json())
      .then((d) => {
        if (d.unlocked) setUnlocked(true);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // Show a toast if NextAuth bounced a new user with AccessDenied
  useEffect(() => {
    if (searchParams.get("error") === "AccessDenied") {
      toast.error("New here? Enter the invite code below first.");
    }
  }, [searchParams]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !code.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Invalid code");
        return;
      }

      setUnlocked(true);
      toast.success("Code accepted — you can now sign up.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignIn() {
    signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900">
            <ShieldCheck className="h-5 w-5 text-neutral-400" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {checking ? "Checking access…" : "Restricted access"}
          </h1>
          <p className="text-sm text-neutral-400 mt-2">
            {checking
              ? "Please wait a moment."
              : "Sign in with Google, or enter an invite code if you're new."}
          </p>
        </div>

        {/* Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
          {checking ? (
            /* ─── Initial loading state ─── */
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
              <p className="text-xs text-neutral-500">Verifying session…</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* ─── Google button — always enabled ─── */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-white text-neutral-900 font-medium text-sm py-2.5 transition hover:bg-neutral-200"
              >
                <LogIn className="h-4 w-4" />
                Continue with Google
              </button>

              {/* ─── Divider ─── */}
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-neutral-800" />
                <span className="text-xs text-neutral-600">new users only</span>
                <span className="h-px flex-1 bg-neutral-800" />
              </div>

              {/* ─── Code form — always visible ─── */}
              <form onSubmit={handleUnlock} className="space-y-4">
                <div>
                  <label
                    htmlFor="code"
                    className="block text-sm font-medium text-neutral-300 mb-1.5"
                  >
                    Invite code
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                    <input
                      id="code"
                      type="password"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        if (error) setError("");
                        if (unlocked) setUnlocked(false);
                      }}
                      placeholder="••••••••"
                      disabled={loading || unlocked}
                      autoComplete="off"
                      className="w-full rounded-lg bg-neutral-950 border border-neutral-800 pl-10 pr-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-neutral-600 focus:ring-2 focus:ring-neutral-700 disabled:opacity-50"
                    />
                  </div>
                </div>

                {unlocked ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2.5 text-sm text-emerald-400">
                    <Check className="h-4 w-4" />
                    Code accepted — sign up with Google now.
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={loading || !code.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-200 font-medium text-sm py-2.5 transition hover:border-neutral-700 hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Checking…
                      </>
                    ) : (
                      <>
                        <KeyRound className="h-4 w-4" />
                        Verify code
                      </>
                    )}
                  </button>
                )}
              </form>

              {/* ─── Error ─── */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-400"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-xs text-neutral-600 text-center mt-6">
          Access is invite-only for new accounts.
        </p>
      </div>
    </main>
  );
}
