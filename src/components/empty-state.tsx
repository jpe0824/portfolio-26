import { JeMark } from "./je-mark";

export function EmptyState() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-10 p-8">
      <div className="flex flex-col items-center gap-2">
        <JeMark className="text-4xl font-bold tracking-tight" />
        {/* JeMark already exposes "jason edman" as its accessible name. */}
        <p className="text-fg-muted" aria-hidden="true">
          jason edman
        </p>
      </div>
      <p className="text-fg-muted">select a file to begin</p>
    </div>
  );
}
