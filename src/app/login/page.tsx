"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  KeyRound,
  LogIn,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Check,
  RefreshCw,
} from "lucide-react";

interface UnlockErrorBody {
  error?: string;
}

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");

  /**
   * Initial cookie check.
   *
   * If NextAuth bounced us back with `error=AccessDenied`, the `login_code`
   * cookie on disk is stale — the code was consumed or expired between the
   * unlock POST and the sign-in callback. Skip the cookie check entirely and
   * force the user back into the form.
   *
   * Re-runs when `authError` changes so a client-side redirect also
   * triggers the re-entry UX.
   */
  useEffect(() => {
    const load = () => {
      let cancelled = false;

      if (authError === "AccessDenied") {
        setChecking(false);
        setUnlocked(false);
        setError(
          "That invite code is no longer valid. Please enter a new one.",
        );
        toast.error("Invite code expired or was already used.");
        return;
      }

      axios
        .get<{ unlocked?: boolean }>("/api/auth/unlock")
        .then(({ data }) => {
          if (cancelled) return;
          if (data.unlocked) setUnlocked(true);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setChecking(false);
        });

      return () => {
        cancelled = true;
      };
    };
    load();
  }, [authError]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !code.trim()) return;

    setLoading(true);
    setError("");

    try {
      await axios.post("/api/auth/unlock", { code: code.trim() });
      setUnlocked(true);
      toast.success("Code accepted — you can now sign up.");
    } catch (err: unknown) {
      if (axios.isAxiosError<UnlockErrorBody>(err)) {
        setError(err.response?.data?.error ?? "Invalid code");
      } else {
        setError("Network error. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignIn() {
    signIn("google", { callbackUrl: "/dashboard" });
  }

  function handleResetCode() {
    setUnlocked(false);
    setCode("");
    setError("");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900">
            <ShieldCheck className="h-5 w-5 text-neutral-300" />
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight text-white">
            {checking ? "Checking access…" : "Restricted access"}
          </h1>
          <p className="text-sm text-neutral-500 mt-3 leading-relaxed">
            {checking
              ? "Please wait a moment."
              : unlocked
                ? "You're all set. Continue with Google to sign in."
                : "Sign in with Google, or enter an invite code if you're new."}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          {checking ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
              <p className="text-xs text-neutral-500">Verifying session…</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Google button — always the primary action */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-neutral-900 font-medium text-sm py-3 transition-colors duration-200 hover:bg-neutral-100 active:scale-[0.985] cursor-pointer"
              >
                <LogIn className="h-4 w-4" />
                Continue with Google
              </button>

              {unlocked ? (
                /* ─── Unlocked: form hidden, confirmation shown ─── */
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-3 py-2.5 text-sm text-emerald-400">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>Code accepted — sign up with Google now.</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetCode}
                    className="mx-auto flex items-center justify-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Use a different code
                  </button>
                </div>
              ) : (
                /* ─── Locked: divider + code form ─── */
                <>
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-neutral-800" />
                    <span className="text-xs text-neutral-600">
                      new users only
                    </span>
                    <span className="h-px flex-1 bg-neutral-800" />
                  </div>

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
                          }}
                          placeholder="••••••••"
                          disabled={loading}
                          autoComplete="off"
                          className="w-full rounded-xl bg-neutral-950 border border-neutral-800 pl-10 pr-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-neutral-600 disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !code.trim()}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-200 font-medium text-sm py-2.5 transition-colors duration-200 hover:border-neutral-700 hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.985]"
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
                  </form>
                </>
              )}

              {/* Error — visible in both states */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-400  "
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-xs text-neutral-600 text-center mt-8">
          First time users need invite code to login.
        </p>
      </div>
    </main>
  );
}
