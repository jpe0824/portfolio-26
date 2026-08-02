import type { ContentNode } from "@/content/manifest";
import { allFiles } from "@/content/resolve";

export type Segment = { text: string; href?: string };

/**
 * Splits a line of model output into plain and linked segments.
 *
 * Only paths that exist in the manifest become links, which is what makes a hallucinated
 * filename harmless: it stays inert text instead of becoming a link to a dead route. Matching
 * is against `source` (the path with its extension, e.g. `projects/personal/1kout.md`) because
 * that is the spelling the system prompt uses to delimit files — the prompt and this function
 * must agree on one spelling of a file's identity or citations silently stop resolving.
 *
 * Invariant: `citeSegments(line, nodes).map(s => s.text).join("") === line`, the same rule
 * tokenize-json.ts holds. Breaking it silently drops characters from rendered output.
 */
export function citeSegments(line: string, nodes: ContentNode[]): Segment[] {
  // Longest first, so a nested path wins over any shorter path sharing its start offset.
  const files = allFiles(nodes).sort((a, b) => b.source.length - a.source.length);

  const segments: Segment[] = [];
  let cursor = 0;

  while (cursor < line.length) {
    let bestAt = -1;
    let bestFile: (typeof files)[number] | null = null;

    for (const file of files) {
      const at = line.indexOf(file.source, cursor);
      // Strict `<` keeps the longest candidate on a tie, since `files` is sorted longest first.
      if (at !== -1 && (bestAt === -1 || at < bestAt)) {
        bestAt = at;
        bestFile = file;
      }
    }

    if (!bestFile) break;

    if (bestAt > cursor) segments.push({ text: line.slice(cursor, bestAt) });
    segments.push({ text: bestFile.source, href: `/${bestFile.path}` });
    cursor = bestAt + bestFile.source.length;
  }

  if (cursor < line.length) segments.push({ text: line.slice(cursor) });
  return segments;
}
