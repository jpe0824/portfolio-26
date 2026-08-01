import { listDir } from "@/content/resolve";
import type { ContentNode } from "@/content/manifest";
import { resolveArg, resolvePath } from "./resolve-path";
import type { CommandContext, CommandResult, OutputLine } from "./types";

export const UNKNOWN_INPUT = "▸ not a command. phase 2b will route this to the model.";

export type Command = {
  name: string;
  summary: string;
  run(args: string[], ctx: CommandContext): CommandResult | Promise<CommandResult>;
};

function out(...lines: OutputLine[]): CommandResult {
  return { kind: "output", lines };
}

function error(text: string): CommandResult {
  return out({ text, tone: "error" });
}

function entry(node: ContentNode): OutputLine {
  return node.kind === "dir"
    ? { text: `${node.name}/`, tone: "accent" }
    : { text: node.name };
}

export function displayPath(cwd: string): string {
  return cwd ? `~/portfolio-26/${cwd}` : "~/portfolio-26";
}

function drawTree(nodes: ContentNode[], depth = 0): OutputLine[] {
  const lines: OutputLine[] = [];
  for (const node of nodes) {
    lines.push({ ...entry(node), text: `${"  ".repeat(depth)}${entry(node).text}` });
    if (node.kind === "dir") lines.push(...drawTree(node.children, depth + 1));
  }
  return lines;
}

export const commands: Command[] = [
  {
    name: "ls",
    summary: "list directory contents",
    run(args, ctx) {
      const target = args[0] ?? "";
      const entries = listDir(ctx.manifest, resolvePath(target, ctx.cwd));
      if (!entries) return error(`ls: no such file or directory: ${target}`);
      return out(...entries.map(entry));
    },
  },
  {
    name: "cd",
    summary: "change the working directory",
    run(args, ctx) {
      const target = args[0] ?? "~";
      const path = resolvePath(target, ctx.cwd);
      if (listDir(ctx.manifest, path) === null) {
        return error(`cd: not a directory: ${target}`);
      }
      return { kind: "cwd", cwd: path };
    },
  },
  {
    name: "pwd",
    summary: "print the working directory",
    run(_args, ctx) {
      return out({ text: displayPath(ctx.cwd) });
    },
  },
  {
    name: "tree",
    summary: "print the whole content tree",
    run(_args, ctx) {
      return out(...drawTree(ctx.manifest));
    },
  },
  {
    name: "open",
    summary: "open a file in the editor",
    run(args, ctx) {
      const target = args[0];
      if (!target) return error("open: missing operand");
      const node = resolveArg(ctx.manifest, target, ctx.cwd);
      if (!node) return error(`open: no such file or directory: ${target}`);
      return { kind: "navigate", path: `/${node.path}` };
    },
  },
  {
    name: "close",
    summary: "close the open file",
    run() {
      return { kind: "navigate", path: "/" };
    },
  },
  {
    name: "clear",
    summary: "clear the terminal",
    run() {
      return { kind: "clear" };
    },
  },
  {
    name: "help",
    summary: "list available commands",
    run() {
      const width = Math.max(...commands.map((c) => c.name.length));
      return out(
        ...commands.map((c) => ({ text: `${c.name.padEnd(width + 2)}${c.summary}` })),
      );
    },
  },
];

export function findCommand(name: string): Command | undefined {
  return commands.find((command) => command.name === name);
}
