import { listDir } from "@/content/resolve";
import { commands } from "./registry";
import { resolvePath } from "./resolve-path";
import type { CommandContext } from "./types";

export type Completion = { completed: string; candidates: string[] };

/**
 * Shell-style completion of the active token.
 *
 * Extends to the longest common prefix. When that adds nothing, the caller
 * prints `candidates` and leaves the input alone — the same beat a real shell
 * gives you on a second Tab.
 */
export function complete(input: string, ctx: CommandContext): Completion {
  if (input.trim() === "") return { completed: input, candidates: [] };

  const boundary = input.lastIndexOf(" ");
  const head = input.slice(0, boundary + 1);
  const token = input.slice(boundary + 1);

  // Command-vs-path is decided by whether anything precedes the active token,
  // not by whether a space exists — leading whitespace alone (" ls") must
  // still be treated as the first token, not a path argument.
  const options = head.trim() === "" ? commandOptions(token) : pathOptions(token, ctx);

  if (options.matches.length === 0) return { completed: input, candidates: [] };

  if (options.matches.length === 1) {
    const only = options.matches[0];
    // A directory keeps the cursor inside it; anything else gets a separating space.
    const tail = only.endsWith("/") ? "" : " ";
    return { completed: `${head}${options.prefix}${only}${tail}`, candidates: [] };
  }

  const shared = longestCommonPrefix(options.matches);
  const extended = `${head}${options.prefix}${shared}`;
  if (extended.length > input.length) return { completed: extended, candidates: [] };

  return { completed: input, candidates: options.matches };
}

function commandOptions(token: string) {
  return {
    prefix: "",
    matches: commands.map((c) => c.name).filter((name) => name.startsWith(token)),
  };
}

function pathOptions(token: string, ctx: CommandContext) {
  const cut = token.lastIndexOf("/");
  const dir = cut === -1 ? "" : token.slice(0, cut + 1);
  const stem = cut === -1 ? token : token.slice(cut + 1);

  const entries = listDir(ctx.manifest, resolvePath(dir, ctx.cwd)) ?? [];
  const matches = entries
    .map((node) => (node.kind === "dir" ? `${node.name}/` : node.name))
    .filter((name) => name.startsWith(stem));

  return { prefix: dir, matches };
}

function longestCommonPrefix(values: string[]): string {
  let prefix = values[0];
  for (const value of values.slice(1)) {
    while (!value.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}
