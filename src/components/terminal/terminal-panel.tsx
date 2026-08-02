"use client";

import { useEffect, useRef, useState } from "react";
import { displayPath } from "@/lib/commands/registry";
import { useCommandSurface } from "./command-surface";

const TONE: Record<string, string> = {
  default: "text-fg-muted",
  dim: "text-fg-muted opacity-70",
  accent: "text-cyan",
  error: "text-red",
};

export function TerminalPanel() {
  const { terminalOpen, setTerminalOpen, cwd, entries, history, submit, completeInput } =
    useCommandSurface();
  const [input, setInput] = useState("");
  const [cursor, setCursor] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (terminalOpen) inputRef.current?.focus();
  }, [terminalOpen]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [entries]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Tab only completes a non-empty prompt. On an empty one it moves focus as
    // usual, so a keyboard user is never trapped in the terminal.
    if (event.key === "Tab" && input !== "") {
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

      {terminalOpen ? (
        <div id="terminal-body" className="flex h-[35dvh] min-h-32 flex-col border-t border-edge">
          <div ref={scrollRef} aria-live="polite" className="min-h-0 flex-1 overflow-auto px-3 py-2">
            {entries.map((entry) => (
              <div key={entry.id}>
                {entry.prompt ? <p className="text-fg">{entry.prompt}</p> : null}
                {entry.lines.map((line, i) => (
                  <p key={i} className={TONE[line.tone ?? "default"]}>
                    {line.text}
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
              {displayPath(cwd)} ❯
            </span>
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Terminal input"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-fg outline-none"
            />
          </form>
        </div>
      ) : null}
    </section>
  );
}
