"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { manifest } from "@/content/manifest";
import { complete } from "@/lib/commands/complete";
import { runCommand } from "@/lib/commands/run";
import { displayPath } from "@/lib/commands/registry";
import type { CommandContext, GrepHit, OutputLine } from "@/lib/commands/types";

export type Entry = {
  id: number;
  prompt?: string;
  lines: OutputLine[];
  /** Model output: rendered with citation links. Command output is never linkified. */
  chat?: boolean;
  /** True while tokens are still arriving, so the log region can advertise aria-busy. */
  streaming?: boolean;
};

type Surface = {
  terminalOpen: boolean;
  setTerminalOpen: (open: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  cwd: string;
  mode: "shell" | "ai";
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
  const [mode, setMode] = useState<"shell" | "ai">("shell");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
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

  // Kept out of runCommand deliberately: the registry is pure and synchronous-ish over the
  // content tree, and a network call with streaming partial state does not belong in it.
  const askModel = useCallback(
    async (question: string, prompt: string) => {
      const id = nextId.current++;
      setEntries((past) => [...past, { id, prompt, lines: [], chat: true, streaming: true }]);

      const history = [...messages, { role: "user" as const, content: question }].slice(-6);
      let answer = "";

      const settle = (lines: OutputLine[]) =>
        setEntries((past) =>
          past.map((entry) => (entry.id === id ? { ...entry, lines, streaming: false } : entry)),
        );

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });

        // The client owns the failure copy rather than echoing the server's body, so the
        // degraded line reads the same whether the route 429s, 502s, or is not deployed at all.
        if (!response.ok || !response.body) {
          settle([
            { text: "▸ the model is resting. try `grep`, `tree`, or `open whoami.md`.", tone: "dim" },
          ]);
          return;
        }

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
          answer += chunk.value;
          const lines = answer.split("\n").map((text) => ({ text }));
          setEntries((past) => past.map((entry) => (entry.id === id ? { ...entry, lines } : entry)));
        }

        settle(answer.split("\n").map((text) => ({ text })));
        setMessages([...history, { role: "assistant" as const, content: answer }].slice(-6));
      } catch (error) {
        console.error(error);
        settle([{ text: "▸ the model is unreachable. the rest of the site still works.", tone: "error" }]);
      }
    },
    [messages],
  );

  const submit = useCallback(
    async (input: string) => {
      const prompt = `${mode === "ai" ? "ai" : displayPath(cwd)} ❯ ${input}`;
      if (input.trim() !== "") setHistory((past) => [...past, input]);

      // In chat mode only `exit` and `clear` are intercepted; everything else is a question.
      // Without this, a visitor asking "what does ls do?" would get a directory listing.
      if (mode === "ai") {
        const word = input.trim();
        if (word !== "exit" && word !== "clear") {
          if (word === "") return;
          await askModel(word, prompt);
          return;
        }
      }

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

        if (result.kind === "mode") {
          setMode(result.mode);
          setEntries((past) => [
            ...past,
            {
              id: nextId.current++,
              prompt,
              lines:
                result.mode === "ai"
                  ? [{ text: "▸ chat mode — ask about this site. `exit` to return.", tone: "dim" }]
                  : [],
            },
          ]);
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
    [ctx, cwd, mode, router, askModel],
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
      mode,
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
      mode,
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
