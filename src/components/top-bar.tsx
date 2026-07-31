import { JeMark } from "./je-mark";

export function TopBar() {
  return (
    <header className="flex h-9 shrink-0 items-center gap-3 border-b border-edge bg-panel px-3">
      <JeMark className="font-bold tracking-tight" />
      <span className="text-fg-subtle" aria-hidden="true">
        jason edman
      </span>
    </header>
  );
}
