"use client";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { ConfirmationDialog } from "../../types/ConfirmationDialog.types";

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  loading = false,
}: ConfirmationDialog) {
  // Synchronous double-click guard — blocks a second click in the same
  // tick before `loading` (which is async state) has a chance to flip.
  const submittingRef = useRef(false);

  // Release the lock when the parent finishes (loading → false).
  // The parent's `onConfirm` is expected to set loading=true at start
  // and loading=false on completion/error — that's the whole point of
  // the `loading` prop.
  useEffect(() => {
    if (!loading) submittingRef.current = false;
  }, [loading]);

  // Also release when the dialog closes entirely — so the next time it
  // opens it starts with a clean lock.
  useEffect(() => {
    if (!isOpen) submittingRef.current = false;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (submittingRef.current || loading) return;
    submittingRef.current = true;

    try {
      await onConfirm();
    } catch {
      // Release the lock if onConfirm threw before setting loading — the
      // [loading] effect won't fire in that case, so without this the
      // button would be permanently dead.
      submittingRef.current = false;
    }
    // On success, the [loading] effect above releases the lock when the
    // parent resets loading to false.
  };

  const handleCancel = () => {
    if (submittingRef.current || loading) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-base font-semibold text-neutral-100">{title}</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-400">
          {message}
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            aria-busy={loading}
            className={`flex-1 flex items-center justify-center gap-2 cursor-pointer rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
              variant === "danger"
                ? "bg-red-500/90 text-white hover:bg-red-500"
                : "bg-neutral-100 text-neutral-900 hover:bg-white"
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Working…
              </>
            ) : (
              confirmText
            )}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 cursor-pointer rounded-lg border border-neutral-800 px-4 py-2.5 text-sm text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
