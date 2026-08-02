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
  const { setPaletteOpen, setTerminalOpen, terminalOpen, runInTerminal } = useCommandSurface();

  function onClick() {
    if (action === "palette") setPaletteOpen(true);
    if (action === "terminal") setTerminalOpen(!terminalOpen);
    if (action === "help") runInTerminal("help");
  }

  // Only the terminal row is a disclosure control — it toggles #terminal-body (always rendered,
  // per Task 9), so it alone gets aria-expanded/aria-controls. The palette and help rows don't
  // disclose anything in place, so giving them the same attributes would be a false state
  // announcement to assistive tech.
  const disclosureProps =
    action === "terminal"
      ? { "aria-expanded": terminalOpen, "aria-controls": "terminal-body" }
      : {};

  return (
    <button
      type="button"
      onClick={onClick}
      {...disclosureProps}
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
