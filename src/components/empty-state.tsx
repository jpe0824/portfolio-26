import { JeMark } from "./je-mark";
import { ShortcutRow } from "./shortcut-row";

// `-safe` on both centring axes, plus `overflow-auto`, and all three are load-bearing.
// Plain `justify-center` distributes overflow to BOTH ends, so on a short viewport (a landscape
// phone, or any window with the terminal open) the first child is pushed to a negative offset —
// outside the box, where the opaque top bar paints over it — while the last child spills past the
// bottom into the terminal header, which then wins the hit test. `-safe` collapses to
// start-alignment the moment content stops fitting, which puts every overflowing pixel on one
// side; `overflow-auto` then makes that side reachable. Neither alone is enough: without
// `overflow-auto` the safe-aligned overflow is still clipped away by ancestors, and without
// `-safe` the content that overflows upward sits at a negative scroll offset that `scrollTop: 0`
// cannot reach. The file route already wraps its own viewport this way (see [[...path]]/page.tsx).
export function EmptyState() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center-safe justify-center-safe gap-10 overflow-auto p-8">
      <div className="flex flex-col items-center gap-2">
        <JeMark className="text-4xl font-bold tracking-tight" />
        {/* JeMark already exposes "jason edman" as its accessible name. */}
        <p className="text-fg-muted" aria-hidden="true">
          jason edman
        </p>
      </div>
      <div className="js-only flex flex-col items-start gap-1">
        <ShortcutRow keys="⌘K" label="command palette" action="palette" />
        <ShortcutRow keys="⌃`" label="toggle terminal" action="terminal" />
        <ShortcutRow keys="?" label="help" action="help" />
      </div>
      <p className="text-fg-muted">select a file to begin</p>
    </div>
  );
}
