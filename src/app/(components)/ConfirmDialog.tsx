"use client";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
  loading?: boolean;
}

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
}: Props) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-base font-semibold text-neutral-100">{title}</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-400">
          {message}
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 cursor-pointer rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
              variant === "danger"
                ? "bg-red-500/90 text-white hover:bg-red-500"
                : "bg-neutral-100 text-neutral-900 hover:bg-white"
            }`}
          >
            {loading ? "Working…" : confirmText}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 cursor-pointer rounded-lg border border-neutral-800 px-4 py-2.5 text-sm text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
