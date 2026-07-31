export function ChipRow() {
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-t border-edge bg-panel px-3">
      <span className="rounded border border-edge px-2 py-0.5 text-fg-muted opacity-70">
        /commands
        <span className="sr-only"> — not yet available, planned for a later phase</span>
      </span>
      <span className="text-fg-subtle" aria-hidden="true">
        phase 2
      </span>
    </div>
  );
}
