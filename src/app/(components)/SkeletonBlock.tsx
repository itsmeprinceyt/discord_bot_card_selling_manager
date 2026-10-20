export default function SkeletonBlock({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-md bg-neutral-800/70 ${className}`}
    />
  );
}
