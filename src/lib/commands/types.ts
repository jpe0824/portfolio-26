import type { ContentNode } from "@/content/manifest";

export type OutputLine = {
  text: string;
  tone?: "default" | "dim" | "accent" | "error";
};

export type GrepHit = { path: string; line: number; text: string };

export type CommandResult =
  | { kind: "output"; lines: OutputLine[] }
  | { kind: "navigate"; path: string }
  | { kind: "cwd"; cwd: string }
  | { kind: "mode"; mode: "shell" | "ai" }
  | { kind: "clear" };

export type CommandContext = {
  /** Terminal-local working directory as a manifest path. Root is "", displayed as ~. */
  cwd: string;
  manifest: ContentNode[];
  /** Injected so commands stay pure and testable. Backed by /content-index.json in the browser. */
  readFile: (source: string) => Promise<string>;
  grep: (term: string) => Promise<GrepHit[]>;
};
