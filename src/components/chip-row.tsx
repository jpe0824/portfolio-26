export function ChipRow() {
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-t border-edge bg-panel px-3">
      <span
        className="rounded border border-edge px-2 py-0.5 text-fg-subtle"
        title="Coming in phase 2"
      >
        /commands
      </span>
      <span className="text-fg-subtle" aria-hidden="true">
        phase 2
      </span>
    </div>
  );
}
