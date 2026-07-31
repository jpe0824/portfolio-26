import type { ContentNode } from "./manifest";

export function resolveNode(nodes: ContentNode[], segments: string[]): ContentNode | null {
  const target = segments.join("/");
  for (const node of nodes) {
    if (node.path === target) return node;
    if (node.kind === "dir") {
      const hit = resolveNode(node.children, segments);
      if (hit) return hit;
    }
  }
  return null;
}

export function allPaths(nodes: ContentNode[]): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    out.push(node.path);
    if (node.kind === "dir") out.push(...allPaths(node.children));
  }
  return out;
}
