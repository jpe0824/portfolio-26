"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { displayPath } from "@/lib/commands/registry";
import { useCommandSurface } from "./command-surface";
import { manifest } from "@/content/manifest";
import { citeSegments } from "@/lib/ai/cite";
import type { OutputLine } from "@/lib/commands/types";

const TONE: Record<NonNullable<OutputLine["tone"]>, string> = {
  default: "text-fg-muted",
  dim: "text-fg-muted opacity-70",
  accent: "text-cyan",
  error: "text-red",
};

// Applied to every scrollback line (both the echoed prompt and command output):
// `whitespace-pre-wrap` preserves the indentation `tree` and the column alignment `help`
// build with repeated spaces — normal whitespace collapsing flattens both to a single space,
// which erases the only thing `tree` communicates (nesting depth). `min-h-[1lh]` gives a
// genuinely empty line (a blank line in a cat'd file) a line box: an empty paragraph with no
// text node at all does not generate one on its own, `pre-wrap` or not, so blank lines would
// otherwise collapse to zero height and the output would no longer match the file.
const LINE = "whitespace-pre-wrap min-h-[1lh]";

// Only chat output is linkified. `cat` prints file text verbatim, and turning paths inside it
// into links would quietly change shell behavior other specs depend on.
function LineBody({ text, chat }: { text: string; chat: boolean }) {
  if (!chat) return <>{text}</>;
  return (
    <>
      {citeSegments(text, manifest).map((segment, i) =>
        segment.href ? (
          // cyan, never primary — primary is the key color, reserved for the brand mark.
          <Link key={i} href={segment.href} className="text-cyan underline">
            {segment.text}
          </Link>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </>
  );
}

export function TerminalPanel() {
  const {
    terminalOpen,
    setTerminalOpen,
    cwd,
    mode,
    entries,
    history,
    submit,
    completeInput,
    focusRequest,
  } = useCommandSurface();
  const [input, setInput] = useState("");
  const [cursor, setCursor] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (terminalOpen) {
      inputRef.current?.focus();
    } else if (wasOpenRef.current) {
      // Only on a genuine open->close transition, not on first mount — otherwise the toggle
      // button would steal focus from the skip link at initial page load.
      toggleRef.current?.focus();
    }
    wasOpenRef.current = terminalOpen;
    // focusRequest is a counter, not a state mirror: runInTerminal bumps it on every dispatch so
    // this effect also runs when the panel was ALREADY open, where `terminalOpen` alone never
    // changes and focus would otherwise stay wherever the caller left it (on <body>, after the
    // palette closes).
  }, [terminalOpen, focusRequest]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [entries]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Tab only completes a non-empty prompt, and only the forward direction — Shift+Tab must
    // still egress backward. Without the shiftKey guard, both directions on a non-empty prompt
    // ran completion and preventDefault, leaving no backward keyboard exit from the terminal at
    // all. `.trim()` (not a bare emptiness check) matches complete()'s own guard, so a
    // whitespace-only prompt is treated the same as a truly empty one.
    if (event.key === "Tab" && !event.shiftKey && input.trim() !== "") {
      event.preventDefault();
      setInput(completeInput(input));
      return;
    }
    if (event.key === "Escape") {
      inputRef.current?.blur();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) return;
      const next = cursor === null ? history.length - 1 : Math.max(0, cursor - 1);
      if (cursor === null) setDraft(input);
      setCursor(next);
      setInput(history[next]);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (cursor === null) return;
      const next = cursor + 1;
      if (next >= history.length) {
        setCursor(null);
        setInput(draft);
        return;
      }
      setCursor(next);
      setInput(history[next]);
    }
  }

  return (
    <section
      aria-label="Terminal"
      className="js-only flex shrink-0 flex-col border-t border-edge bg-panel"
    >
      <div className="flex h-8 shrink-0 items-center gap-3 px-3">
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={terminalOpen}
          aria-controls="terminal-body"
          onClick={() => setTerminalOpen(!terminalOpen)}
          className="text-fg-muted hover:text-fg"
        >
          TERMINAL
        </button>
        <span className="ml-auto text-fg-muted opacity-70" aria-hidden="true">
          {terminalOpen ? "⌃` to hide" : "⌃` to show"}
        </span>
      </div>

      {/* Always rendered, visibility toggled via `hidden` — not conditionally mounted. A
          conditionally-mounted body means aria-controls="terminal-body" is an unresolvable IDREF
          in the collapsed state (the default at first paint), which is invalid ARIA. It also
          means the aria-live region is destroyed and recreated on every toggle, so it re-mounts
          already populated with the whole scrollback — the exact case that makes some screen
          readers announce everything at once instead of just the new line. Keeping it mounted
          avoids both. `hidden` and the flex/hidden className swap agree with each other rather
          than fighting over `display`, so the collapsed state can't be defeated by utility
          specificity. */}
      <div
        id="terminal-body"
        hidden={!terminalOpen}
        className={
          terminalOpen ? "flex h-[35dvh] min-h-32 flex-col border-t border-edge" : "hidden"
        }
      >
        <div
          ref={scrollRef}
          role="log"
          aria-busy={entries.some((entry) => entry.streaming)}
          className="min-h-0 flex-1 overflow-auto px-3 py-2"
        >
          {entries.map((entry) => (
            <div key={entry.id}>
              {entry.prompt ? <p className={`${LINE} text-fg`}>{entry.prompt}</p> : null}
              {entry.lines.map((line, i) => (
                <p key={i} className={`${LINE} ${TONE[line.tone ?? "default"]}`}>
                  <LineBody text={line.text} chat={!!entry.chat} />
                </p>
              ))}
            </div>
          ))}
        </div>

        <form
          className="flex shrink-0 items-baseline gap-2 border-t border-edge px-3 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = input;
            setInput("");
            setCursor(null);
            void submit(value);
          }}
        >
          <span className="shrink-0 text-cyan" aria-hidden="true">
            {mode === "ai" ? "ai" : displayPath(cwd)} ❯
          </span>
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            // The cwd is otherwise invisible to assistive tech: the prompt span above is
            // aria-hidden (it's a visual glyph, `❯`, not meant to be read), and a static label
            // would give a screen-reader user no signal that `cd` changed the working directory.
            aria-label={mode === "ai" ? "Chat input" : `Terminal input (${displayPath(cwd)})`}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-fg"
          />
        </form>
      </div>
    </section>
  );
}
