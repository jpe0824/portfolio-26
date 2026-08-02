"use client";

import { useCommandSurface } from "./terminal/command-surface";

export function ShortcutRow({
  keys,
  label,
  action,
}: {
  keys: string;
  label: string;
  action: "palette" | "terminal" | "help";
}) {
  const { setPaletteOpen, setTerminalOpen, terminalOpen, submit } = useCommandSurface();

  function onClick() {
    if (action === "palette") setPaletteOpen(true);
    if (action === "terminal") setTerminalOpen(!terminalOpen);
    if (action === "help") {
      setTerminalOpen(true);
      void submit("help");
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-64 items-center gap-4 rounded px-3 py-1.5 text-fg-muted hover:bg-elevated hover:text-fg"
    >
      {/* The key chip is meaningless on a phone, so it only appears where the key exists.
          The row itself stays tappable at every width. */}
      <span className="hidden w-10 shrink-0 text-cyan md:inline" aria-hidden="true">
        {keys}
      </span>
      <span className="w-10 shrink-0 text-cyan md:hidden" aria-hidden="true">
        ›
      </span>
      <span>{label}</span>
    </button>
  );
}
