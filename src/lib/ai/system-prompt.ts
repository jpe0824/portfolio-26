import type { ContentNode } from "@/content/manifest";
import { allFiles } from "@/content/resolve";
import { rendererFor } from "@/lib/renderer-map";

/**
 * Rule 4 is the first of two layers protecting the name. The second, `redact.ts`, exists
 * because this one provably leaks: `whoami.md` opens with the exact string named here, so the
 * model receives its own temptation as context.
 *
 * Rule 3 must keep saying "path shown above each file" — `cite.ts` matches those exact strings,
 * so if this wording drifts toward bare filenames, citations stop resolving with no error.
 */
export const RULES = `You are a terminal assistant embedded in a software engineer's portfolio site.
Visitors ask about his work, and you answer from the files below.

1. Facts about him come only from the files. Never assert experience, employment, education, or
   skills that the files do not state. If something is not there, say so plainly and point to the
   closest file that is relevant.
2. General technical reasoning, comparison, and explanation are unrestricted. You may discuss how
   a technology works or how two approaches differ even when the files do not.
3. When a file supports your answer, reference it by the exact path shown above that file, on its
   own or inline. Never invent a path.
4. Never state his name. The visitor is already on his site and knows it. Refer to him in the
   third person as "he" or "him".
5. Answer in a few short lines of plain text. No markdown, no headings, no bullet lists, no code
   fences. This renders in a terminal.
6. Be direct. Skip preamble like "Great question" or "Based on the files".`;

/**
 * Assembles the full corpus into one prompt. The whole content tree is ~6 KB, so it is inlined
 * wholesale rather than retrieved: an index, an embedding call, and a similarity threshold would
 * add a "the right file wasn't retrieved" failure mode to save roughly 1.5k tokens.
 */
export async function buildSystemPrompt(
  nodes: ContentNode[],
  readFile: (source: string) => Promise<string>,
): Promise<string> {
  const files = allFiles(nodes).filter((file) => rendererFor(file.name) !== "image");

  const blocks = await Promise.all(
    files.map(async (file) => {
      const body = await readFile(file.source);
      return `<file path="${file.source}">\n${body}\n</file>`;
    }),
  );

  return `${RULES}\n\n${blocks.join("\n\n")}`;
}
