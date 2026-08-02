"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { manifest } from "@/content/manifest";
import { complete } from "@/lib/commands/complete";
import { runCommand } from "@/lib/commands/run";
import { displayPath } from "@/lib/commands/registry";
import type { CommandContext, GrepHit, OutputLine } from "@/lib/commands/types";

export type Entry = { id: number; prompt?: string; lines: OutputLine[] };

type Surface = {
  terminalOpen: boolean;
  setTerminalOpen: (open: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  cwd: string;
  entries: Entry[];
  history: string[];
  submit: (input: string) => Promise<void>;
  completeInput: (input: string) => string;
  /** Open the terminal, run `line` in it, and put focus on the terminal input. */
  runInTerminal: (line: string) => void;
  /**
   * Incremented by every runInTerminal call. TerminalPanel watches it to know a focus move was
   * asked for even when `terminalOpen` did not change — see runInTerminal for why that matters.
   */
  focusRequest: number;
};

const SurfaceContext = createContext<Surface | null>(null);

export function useCommandSurface(): Surface {
  const surface = useContext(SurfaceContext);
  if (!surface) throw new Error("useCommandSurface must be used inside <CommandSurface>");
  return surface;
}

// Fetched once, on the first cat or grep, and cached for the page's lifetime —
// but only on success. A rejected fetch (offline, 404, malformed JSON) must not
// pin the failure forever, since a later retry (e.g. the visitor's connection
// comes back) needs a fresh attempt rather than the same dead promise.
let indexPromise: Promise<Record<string, string>> | null = null;

function contentIndex(): Promise<Record<string, string>> {
  indexPromise ??= fetch("/content-index.json")
    .then((response) => {
      if (!response.ok) throw new Error(`content index request failed: ${response.status}`);
      return response.json();
    })
    .catch((error: unknown) => {
      indexPromise = null;
      throw error;
    });
  return indexPromise;
}

export function CommandSurface({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [cwd, setCwd] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [focusRequest, setFocusRequest] = useState(0);
  const nextId = useRef(0);

  const ctx = useMemo<CommandContext>(
    () => ({
      cwd,
      manifest,
      readFile: async (source) => (await contentIndex())[source] ?? "",
      grep: async (term) => {
        const index = await contentIndex();
        const needle = term.toLowerCase();
        const hits: GrepHit[] = [];
        for (const [path, body] of Object.entries(index)) {
          body.split("\n").forEach((text, i) => {
            if (text.toLowerCase().includes(needle)) {
              hits.push({ path, line: i + 1, text: text.trim() });
            }
          });
        }
        return hits;
      },
    }),
    [cwd],
  );

  const submit = useCallback(
    async (input: string) => {
      const prompt = `${displayPath(cwd)} ❯ ${input}`;
      if (input.trim() !== "") setHistory((past) => [...past, input]);

      // cat and grep await ctx.readFile/ctx.grep with no try/catch of their own,
      // so a rejected content-index fetch would otherwise propagate out of
      // runCommand and into submit's `void submit(value)` caller as an unhandled
      // rejection — silently swallowing the command instead of reporting it.
      try {
        const result = await runCommand(input, ctx);

        if (result.kind === "clear") {
          setEntries([]);
          return;
        }

        setEntries((past) => [
          ...past,
          { id: nextId.current++, prompt, lines: result.kind === "output" ? result.lines : [] },
        ]);

        if (result.kind === "cwd") setCwd(result.cwd);
        if (result.kind === "navigate") router.push(result.path);
      } catch (error) {
        // The user-facing line assumes the one failure this branch actually sees
        // (a rejected content-index fetch) — logging the real error keeps a future,
        // unrelated throw here debuggable instead of silently mislabelled.
        console.error(error);
        const [name] = input.trim().split(/\s+/);
        setEntries((past) => [
          ...past,
          {
            id: nextId.current++,
            prompt,
            lines: [{ text: `${name}: content index unavailable`, tone: "error" }],
          },
        ]);
      }
    },
    [ctx, cwd, router],
  );

  // The one dispatch path for "open the terminal and run this line". Its three callers — the `?`
  // chord below, the empty-state shortcut row, and the palette's command items — previously each
  // carried their own copy of these lines.
  //
  // Focus is requested through a counter rather than inferred from the open transition:
  // setTerminalOpen(true) is not a state change when the panel is already open, so the panel's
  // focus effect never re-runs and focus is left wherever the invoking surface dropped it — on
  // <body>, once the palette unmounts. The counter makes the request unconditional.
  const runInTerminal = useCallback(
    (line: string) => {
      setTerminalOpen(true);
      setFocusRequest((n) => n + 1);
      void submit(line);
    },
    [submit],
  );

  const completeInput = useCallback((input: string) => {
    const { completed, candidates } = complete(input, ctx);
    if (candidates.length > 0) {
      setEntries((past) => [
        ...past,
        { id: nextId.current++, lines: [{ text: candidates.join("   "), tone: "dim" }] },
      ]);
    }
    return completed;
  }, [ctx]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || !!target?.isContentEditable;

      // Shift/Alt are deliberately excluded from both chords below: this project
      // already dropped ⌘P rather than hijack a browser shortcut, and the same
      // ruling applies here — Ctrl+Shift+K is Firefox's Web Console, so a chord
      // we did not intend to claim must pass through untouched.
      const noExtraModifiers = !event.shiftKey && !event.altKey;

      // Exclusive-or, not "either": Ctrl+Cmd+K must not fire either — it isn't
      // the chord we claimed, it's both of the alternates held at once.
      if (event.metaKey !== event.ctrlKey && noExtraModifiers && event.key === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      // Everything below this line opens the terminal, and opening the terminal moves focus into
      // it. While the palette is up that focus move lands OUTSIDE a live role="dialog"
      // aria-modal="true" — and Escape, the palette's only documented exit, is bound on the dialog
      // wrapper, so it stops reaching a handler the moment focus leaves. The palette would be
      // stuck open over a terminal the visitor cannot see the point of. ⌘K above stays live
      // precisely because toggling the palette shut is what it is supposed to do.
      //
      // `typing` does not cover this: it only recognises INPUT/TEXTAREA/contentEditable, and the
      // palette's match rows are <button>s, so `?` fired straight through them.
      if (paletteOpen) return;

      if (event.ctrlKey && !event.metaKey && noExtraModifiers && event.key === "`") {
        event.preventDefault();
        setTerminalOpen((open) => !open);
        return;
      }
      if (event.key === "?" && !typing) {
        event.preventDefault();
        runInTerminal("help");
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [paletteOpen, runInTerminal]);

  const value = useMemo<Surface>(
    () => ({
      terminalOpen,
      setTerminalOpen,
      paletteOpen,
      setPaletteOpen,
      cwd,
      entries,
      history,
      submit,
      completeInput,
      runInTerminal,
      focusRequest,
    }),
    [
      terminalOpen,
      paletteOpen,
      cwd,
      entries,
      history,
      submit,
      completeInput,
      runInTerminal,
      focusRequest,
    ],
  );

  return <SurfaceContext.Provider value={value}>{children}</SurfaceContext.Provider>;
}
