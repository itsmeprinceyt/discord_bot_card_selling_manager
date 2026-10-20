"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw,
  PenLine,
  Copy,
  Check,
  X,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from "lucide-react";
import axios from "axios";
import { generateULID } from "../../../utils/generateULID.util";
import getAxiosErrorMessage from "../../../utils/Auth/Auth.AxiosHelper";
import SkeletonBlock from "../SkeletonBlock";

const MAX_LEN = 255;

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function InviteCodeSkeleton() {
  return (
    <div className="w-full max-w-xl">
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-neutral-800/70" />
        <div className="flex-1 space-y-2 pt-0.5">
          <SkeletonBlock className="h-5 w-28" />
          <SkeletonBlock className="h-3 w-64 max-w-full" />
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-lg">
        {/* Label */}
        <SkeletonBlock className="mb-1.5 h-3 w-24" />

        {/* Code field + copy button */}
        <div className="mb-4 flex items-stretch gap-2">
          <div className="h-10.5 flex-1 animate-pulse rounded-lg border border-neutral-800 bg-neutral-800/50" />
          <div className="h-10.5 w-10 shrink-0 animate-pulse rounded-lg bg-neutral-800/70" />
        </div>

        {/* Two action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <SkeletonBlock className="h-10.5 rounded-lg" />
          <SkeletonBlock className="h-10.5 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panel                                                              */
/* ------------------------------------------------------------------ */

export default function InviteCodePanel() {
  const [code, setCode] = useState("");
  const [originalCode, setOriginalCode] = useState("");

  const [mode, setMode] = useState<"view" | "custom">("view");
  const [customDraft, setCustomDraft] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);

  // ── Load current code on mount ─────────────────────────────────────────
  useEffect(() => {
    async function loadCode() {
      try {
        const { data } = await axios.get("/api/admin/invite-code", {
          withCredentials: true,
        });
        if (data.ok) {
          setCode(data.code ?? "");
          setOriginalCode(data.code ?? "");
        } else {
          setStatus({ type: "err", msg: "Failed to load invite code" });
        }
      } catch (err) {
        setStatus({
          type: "err",
          msg: getAxiosErrorMessage(err, "Network error"),
        });
      } finally {
        setLoading(false);
      }
    }
    loadCode();
  }, []);

  // ── Save a new code ────────────────────────────────────────────────────
  async function saveCode(next: string) {
    setSaving(true);
    setStatus(null);

    try {
      const { data } = await axios.put(
        "/api/admin/invite-code",
        { code: next },
        { withCredentials: true },
      );

      if (!data.ok) {
        setStatus({
          type: "err",
          msg: data.error ?? "Failed to update code",
        });
        return false;
      }

      setCode(data.code);
      setOriginalCode(data.code);
      setStatus({ type: "ok", msg: "Saved" });
      setTimeout(() => setStatus(null), 2000);
      return true;
    } catch (err) {
      setStatus({
        type: "err",
        msg: getAxiosErrorMessage(err, "Failed to update code"),
      });
      return false;
    } finally {
      setSaving(false);
    }
  }

  // ── Refresh → generate a new random code ───────────────────────────────
  async function handleRefresh() {
    if (saving) return;
    const next = generateULID({
      prefix: "inv",
      separator: "_",
      maxLength: 32,
    });
    await saveCode(next);
  }

  // ── Custom mode ────────────────────────────────────────────────────────
  function openCustom() {
    setCustomDraft(code);
    setMode("custom");
    setStatus(null);
  }

  function cancelCustom() {
    setMode("view");
    setCustomDraft("");
    setStatus(null);
  }

  async function handleCustomSave() {
    const trimmed = customDraft.trim();
    if (!trimmed) {
      setStatus({ type: "err", msg: "Code cannot be empty" });
      return;
    }
    if (trimmed.length > MAX_LEN) {
      setStatus({ type: "err", msg: `Max ${MAX_LEN} characters` });
      return;
    }
    const ok = await saveCode(trimmed);
    if (ok) setMode("view");
  }

  // ── Copy ───────────────────────────────────────────────────────────────
  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  if (loading) {
    return <InviteCodeSkeleton />;
  }

  return (
    <div className="w-full max-w-xl">
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900">
          <ShieldCheck className="h-5 w-5 text-neutral-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-neutral-100">
            Invite Code
          </h2>
          <p className="text-sm text-neutral-400">
            Only people with this code can unlock the login page.
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-lg">
        {mode === "view" ? (
          <ViewMode
            code={code}
            copied={copied}
            saving={saving}
            onCopy={handleCopy}
            onRefresh={handleRefresh}
            onCustom={openCustom}
          />
        ) : (
          <CustomMode
            draft={customDraft}
            saving={saving}
            onChange={setCustomDraft}
            onCancel={cancelCustom}
            onSave={handleCustomSave}
            onReset={() => setCustomDraft(originalCode)}
          />
        )}

        {/* Status */}
        {status && (
          <div
            role="status"
            className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
              status.type === "ok"
                ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-400"
                : "border-red-900/60 bg-red-950/40 text-red-400"
            }`}
          >
            {status.type === "ok" ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{status.msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── View Mode ─────────────────────────────────────────────────────────────

function ViewMode({
  code,
  copied,
  saving,
  onCopy,
  onRefresh,
  onCustom,
}: {
  code: string;
  copied: boolean;
  saving: boolean;
  onCopy: () => void;
  onRefresh: () => void;
  onCustom: () => void;
}) {
  return (
    <>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">
        Current code
      </label>

      <div className="mb-4 flex items-stretch gap-2">
        <code className="flex-1 truncate rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 font-mono text-sm text-neutral-100">
          {code || <span className="text-neutral-600">— none set —</span>}
        </code>
        <button
          type="button"
          onClick={onCopy}
          disabled={!code}
          title="Copy"
          className="flex h-auto w-10 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-400 transition hover:border-neutral-700 hover:text-neutral-200 disabled:opacity-40 cursor-pointer"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200 disabled:opacity-50 cursor-pointer"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>

        <button
          type="button"
          onClick={onCustom}
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-900 disabled:opacity-50 cursor-pointer"
        >
          <PenLine className="h-4 w-4" />
          Custom
        </button>
      </div>
    </>
  );
}

// ─── Custom Mode ───────────────────────────────────────────────────────────

function CustomMode({
  draft,
  saving,
  onChange,
  onCancel,
  onSave,
  onReset,
}: {
  draft: string;
  saving: boolean;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const length = draft.length;

  return (
    <>
      <div className="mb-1.5 flex items-center justify-between">
        <label
          htmlFor="custom-code"
          className="text-xs font-medium uppercase tracking-wide text-neutral-500"
        >
          Custom code
        </label>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-neutral-500 hover:text-neutral-300 cursor-pointer"
        >
          Reset
        </button>
      </div>

      <input
        id="custom-code"
        type="text"
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your own code…"
        disabled={saving}
        autoFocus
        autoComplete="off"
        maxLength={MAX_LEN}
        className="mb-1 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 font-mono text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-neutral-600 focus:ring-2 focus:ring-neutral-700 disabled:opacity-50"
      />

      <p className="mb-4 text-right text-xs text-neutral-500">
        {length} / {MAX_LEN}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !draft.trim()}
          className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200 disabled:opacity-50 cursor-pointer"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Save
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-900 disabled:opacity-50 cursor-pointer"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </>
  );
}
