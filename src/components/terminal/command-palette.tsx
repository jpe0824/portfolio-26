"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { manifest } from "@/content/manifest";
import { allFiles } from "@/content/resolve";
import { commands } from "@/lib/commands/registry";
import { useCommandSurface } from "./command-surface";

type Item = { kind: "file" | "command"; label: string; hint: string; run: () => void };

// Focusable descendants in DOM order: the query input, then each rendered match button.
// Queried fresh on every Tab press (not memoized) because the match list — and therefore
// this set — shrinks and grows as the user types.
function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('input, button, [href], [tabindex]:not([tabindex="-1"])'),
  ).filter((el) => !el.hasAttribute("disabled"));
}

export function CommandPalette() {
  const router = useRouter();
  const { paletteOpen, setPaletteOpen, setTerminalOpen, submit } = useCommandSurface();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [wasOpen, setWasOpen] = useState(paletteOpen);
  const [invoker, setInvoker] = useState<Element | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<Item[]>(() => {
    const files: Item[] = allFiles(manifest).map((file) => ({
      kind: "file",
      label: file.name,
      hint: "open file",
      run: () => router.push(`/${file.path}`),
    }));
    const verbs: Item[] = commands.map((command) => ({
      kind: "command",
      label: command.name,
      hint: command.summary,
      run: () => {
        setTerminalOpen(true);
        void submit(command.name);
      },
    }));
    return [...files, ...verbs];
  }, [router, setTerminalOpen, submit]);

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
    } else {
      (invoker as HTMLElement | null)?.focus?.();
    }
  }, [paletteOpen, invoker]);

  if (!paletteOpen) return null;

  function choose(item: Item | undefined) {
    if (!item) return;
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
    const current = document.activeElement;
    const atBoundary = forward ? current === last : current === first;
    if (atBoundary || !dialog.contains(current)) {
      event.preventDefault();
      (forward ? first : last).focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-base/70 pt-24"
      onClick={() => setPaletteOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onDialogKeyDown}
        className="w-[min(36rem,90vw)] overflow-hidden rounded border border-edge-strong bg-panel"
      >
        <div className="flex items-baseline gap-2 border-b border-edge px-3 py-2">
          <span className="text-cyan" aria-hidden="true">
            ❯
          </span>
          <input
            ref={inputRef}
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

        <ul className="list-none py-1">
          {matches.map((item, i) => (
            <li key={`${item.kind}:${item.label}`}>
              <button
                type="button"
                onClick={() => choose(item)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-baseline gap-3 px-3 py-1 text-left ${
                  i === active ? "bg-primary-dim text-fg" : "text-fg-muted"
                }`}
              >
                <span className="truncate">{item.label}</span>
                <span className="ml-auto shrink-0 text-fg-muted opacity-70">{item.hint}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 ? <li className="px-3 py-1 text-fg-muted">no matches</li> : null}
        </ul>
      </div>
    </div>
  );
}
