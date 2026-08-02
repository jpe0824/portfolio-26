"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { manifest } from "@/content/manifest";
import { allFiles } from "@/content/resolve";
import { commands } from "@/lib/commands/registry";
import { useCommandSurface } from "./command-surface";

// `id` is the React-key/DOM-id source of truth, kept separate from `label` (what's displayed):
// a file's `path` is unique by construction (routing depends on it), which a file's bare
// `name` is not — two files in different directories can share a basename. A command's `name`
// is unique within the registry by construction too, and is what `run()` actually submits.
type Item = {
  kind: "file" | "command";
  id: string;
  label: string;
  hint: string;
  /**
   * Whether `run` moves focus itself. Only actions that do may skip the invoker restore — see
   * choose(). Commands go through runInTerminal, which focuses the terminal input; a file choice
   * only changes the route, so nothing would catch focus if the restore were skipped there too.
   */
  relocatesFocus: boolean;
  run: () => void;
};

function optionId(index: number): string {
  return `palette-option-${index}`;
}

// Focusable descendants in DOM order: the query input, then each rendered match button.
// Queried fresh on every Tab press (not memoized) because the match list — and therefore
// this set — shrinks and grows as the user types. Only `input`/`button` are queried: nothing
// else in this dialog can match an `[href]` or an explicit `[tabindex]`.
function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("input, button")).filter(
    (el) => !el.hasAttribute("disabled"),
  );
}

export function CommandPalette() {
  const router = useRouter();
  const { paletteOpen, setPaletteOpen, runInTerminal } = useCommandSurface();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [wasOpen, setWasOpen] = useState(paletteOpen);
  const [invoker, setInvoker] = useState<Element | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Set only from event handlers (choose()), never from render — see the effect below for why
  // this exists: restoring focus to the invoker is correct on dismissal (Esc, backdrop click,
  // ⌘K toggled closed) and after choosing an item whose action leaves focus alone, but wrong
  // after choosing one that deliberately moves focus somewhere else (into the terminal input).
  const skipRestoreRef = useRef(false);

  const items = useMemo<Item[]>(() => {
    const files: Item[] = allFiles(manifest).map((file) => ({
      kind: "file",
      id: file.path,
      label: file.name,
      hint: "open file",
      relocatesFocus: false,
      run: () => router.push(`/${file.path}`),
    }));
    const verbs: Item[] = commands.map((command) => ({
      kind: "command",
      id: command.name,
      label: command.name,
      hint: command.summary,
      relocatesFocus: true,
      run: () => runInTerminal(command.name),
    }));
    return [...files, ...verbs];
  }, [router, runInTerminal]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = needle === "" ? items : items.filter((i) => i.label.toLowerCase().includes(needle));
    return pool.slice(0, 10);
  }, [items, query]);

  // Reset query/active/invoker state during render, on the open<->closed transition itself,
  // rather than in an effect: this repo's react-hooks/set-state-in-effect rule (error
  // severity) forbids calling setState synchronously from inside an effect body, and a plain
  // ref write during render is also rejected (react-hooks/refs) — refs may only be read or
  // written outside of render. The "adjusting state when a prop changes" pattern below (see
  // mobile-nav-drawer.tsx for the precedent) is the React-endorsed alternative to both: state,
  // not a ref, carries the invoker across the transition. The `wasOpen !== paletteOpen` guard
  // means this only runs on the actual transition, not every render, so it cannot loop.
  if (paletteOpen !== wasOpen) {
    setWasOpen(paletteOpen);
    if (paletteOpen) {
      setInvoker(document.activeElement);
      setQuery("");
      setActive(0);
    }
  }

  // The imperative focus move itself stays in an effect: moving focus is a side effect on an
  // external system (the DOM), not a React state update, so it doesn't trip either rule above
  // and needs to run after commit, once the target node actually exists in the DOM.
  useEffect(() => {
    if (paletteOpen) {
      inputRef.current?.focus();
      return;
    }
    if (skipRestoreRef.current) {
      skipRestoreRef.current = false;
      return;
    }
    (invoker as HTMLElement | null)?.focus?.();
  }, [paletteOpen, invoker]);

  if (!paletteOpen) return null;

  function choose(item: Item | undefined) {
    if (!item) return;
    // Per item, not unconditionally. Skipping the restore is only correct when the chosen action
    // takes focus for itself; a file choice just pushes a route, so an unconditional skip left
    // focus on <body> — with nothing selected, arrow keys and Tab starting over from the top of
    // the document — for the palette's single most common action.
    skipRestoreRef.current = item.relocatesFocus;
    setPaletteOpen(false);
    item.run();
  }

  // Escape and the Tab trap are handled here, on the dialog wrapper, rather than on the
  // input alone: focus can land on a match button (via Tab), and a keydown fired there
  // never reaches a handler attached only to the input. aria-modal="true" tells assistive
  // tech the rest of the page is inert, so Tab/Shift+Tab must cycle only among this
  // dialog's own focusables, wrapping at both ends — and Esc is the one way out.
  function onDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setPaletteOpen(false);
      return;
    }
    if (event.key !== "Tab") return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusables = focusableIn(dialog);
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const forward = !event.shiftKey;
    // The trap means focus can never be anywhere but inside this dialog while it's open, so
    // the only real question is whether it's currently at the edge that would otherwise let
    // Tab walk out of the trap.
    const atBoundary = forward ? document.activeElement === last : document.activeElement === first;
    if (atBoundary) {
      event.preventDefault();
      (forward ? first : last).focus();
    }
  }

  const activeId = active >= 0 && active < matches.length ? optionId(active) : undefined;
  // Deliberately worded differently from the visible "no matches" text below (not "no
  // matches"/"0 matches"): both live in the dialog at once, and an identical string would make
  // `getByText("no matches")` ambiguous between the visible message and this sr-only one.
  const resultsAnnouncement = `${matches.length} result${matches.length === 1 ? "" : "s"}`;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-base/70 px-4 pt-10 pb-4"
      onClick={() => setPaletteOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onDialogKeyDown}
        className="flex max-h-full w-[min(36rem,90vw)] flex-col overflow-hidden rounded border border-edge-strong bg-panel"
      >
        <div className="flex shrink-0 items-baseline gap-2 border-b border-edge px-3 py-2">
          <span className="text-cyan" aria-hidden="true">
            ❯
          </span>
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((i) => Math.min(matches.length - 1, i + 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              }
              if (event.key === "Enter") {
                event.preventDefault();
                choose(matches[active]);
              }
            }}
            aria-label="Command palette input"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-fg"
          />
        </div>

        {/* min-h-0 lets this shrink below its content height inside the flex column, which is
            what makes overflow-y-auto actually kick in instead of the list just pushing the
            dialog (and the row a Tab lands on) past the bottom of a short viewport — a real
            failure mode at landscape-phone heights, where ten rows plus the header don't fit. */}
        <ul
          id="palette-listbox"
          role="listbox"
          aria-label="Command palette results"
          className="min-h-0 flex-1 list-none overflow-y-auto py-1"
        >
          {matches.map((item, i) => (
            <li key={`${item.kind}:${item.id}`} role="presentation">
              <button
                id={optionId(i)}
                type="button"
                role="option"
                aria-selected={i === active}
                onClick={() => choose(item)}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                className={`flex w-full items-baseline gap-3 px-3 py-1 text-left ${
                  i === active ? "bg-primary-dim text-fg" : "text-fg-muted"
                }`}
              >
                <span className="truncate">{item.label}</span>
                {/* The active row's own opacity-70 dimming was measured at 3.89:1 against
                    bg-primary-dim — below the 4.5:1 AA floor for real content (this is the
                    command summary, not a decoration). Full-strength text-fg on the active row
                    only clears that; non-active rows keep the dimmer 4.71:1-passing style. */}
                <span
                  className={`ml-auto shrink-0 ${
                    i === active ? "text-fg" : "text-fg-muted opacity-70"
                  }`}
                >
                  {item.hint}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {matches.length === 0 ? (
          <p className="shrink-0 px-3 py-1 text-fg-muted">no matches</p>
        ) : null}
        {/* Arrow-key navigation moves aria-activedescendant above without ever moving real DOM
            focus off the input, so a screen reader announces the newly-active option's name —
            but not how many results there are, or that "no matches" is a live count rather than
            static text. This mirrors that count back explicitly. */}
        <p aria-live="polite" className="sr-only">
          {resultsAnnouncement}
        </p>
      </div>
    </div>
  );
}
