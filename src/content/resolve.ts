import type { ContentNode, FileNode } from "./manifest";

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

export function allFiles(nodes: ContentNode[]): FileNode[] {
  const out: FileNode[] = [];
  for (const node of nodes) {
    if (node.kind === "dir") out.push(...allFiles(node.children));
    else out.push(node);
  }
  return out;
}

/** Children of a directory path. The root ("") is the manifest itself. Null if not a directory. */
export function listDir(nodes: ContentNode[], path: string): ContentNode[] | null {
  if (path === "") return nodes;
  const node = resolveNode(nodes, path.split("/"));
  return node && node.kind === "dir" ? node.children : null;
}
