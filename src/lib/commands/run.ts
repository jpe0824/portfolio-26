import { findCommand, UNKNOWN_INPUT } from "./registry";
import type { CommandContext, CommandResult } from "./types";

export function runCommand(
  input: string,
  ctx: CommandContext,
): CommandResult | Promise<CommandResult> {
  const trimmed = input.trim();
  if (trimmed === "") return { kind: "output", lines: [] };

  const [name, ...args] = trimmed.split(/\s+/);
  const command = findCommand(name);

  // One rule for everything unrecognized — a typo and a question get the same
  // response, rather than a heuristic guessing which one the visitor meant.
  if (!command) return { kind: "output", lines: [{ text: UNKNOWN_INPUT, tone: "dim" }] };

  return command.run(args, ctx);
}
