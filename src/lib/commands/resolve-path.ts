import type { ContentNode } from "@/content/manifest";
import { listDir, resolveNode } from "@/content/resolve";

/**
 * Resolve a user-typed path against cwd, returning a manifest path ("" is the root).
 *
 * `..` past the root clamps rather than escaping — the terminal can never address
 * anything outside the content tree, mirroring the guard in readContentFile.
 */
export function resolvePath(input: string, cwd: string): string {
  const raw = input.trim();

  let segments: string[];
  if (raw === "") segments = split(cwd);
  else if (raw === "~" || raw.startsWith("~/")) segments = split(raw.slice(1));
  else if (raw.startsWith("/")) segments = split(raw);
  else segments = [...split(cwd), ...split(raw)];

  const out: string[] = [];
  for (const segment of segments) {
    if (segment === ".") continue;
    if (segment === "..") {
      out.pop(); // no-op at the root, which is the clamp
      continue;
    }
    out.push(segment);
  }
  return out.join("/");
}

function split(value: string): string[] {
  return value.split("/").filter(Boolean);
}

/**
 * Resolve a command argument to a node, accepting either the route path
 * (`whoami`) or the file name (`whoami.md`).
 */
export function resolveArg(
  nodes: ContentNode[],
  input: string,
  cwd: string,
): ContentNode | null {
  const target = resolvePath(input, cwd);
  if (target === "") return null;

  const byPath = resolveNode(nodes, target.split("/"));
  if (byPath) return byPath;

  const parts = target.split("/");
  const name = parts.pop() as string;
  const siblings = listDir(nodes, parts.join("/"));
  return siblings?.find((node) => node.name === name) ?? null;
}
