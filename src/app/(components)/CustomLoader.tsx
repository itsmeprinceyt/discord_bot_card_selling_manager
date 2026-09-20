import { Loader2 } from "lucide-react";

export default function CustomLoader({
  label,
  fullScreen = true,
}: {
  label?: string;
  fullScreen?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${
        fullScreen ? "min-h-screen bg-neutral-950" : "py-12"
      }`}
    >
      <Loader2 size={24} className="animate-spin text-neutral-500" />
      {label && (
        <p className="text-xs text-neutral-500 tracking-wide animate-pulse">
          {label}
        </p>
      )}
    </div>
  );
}
