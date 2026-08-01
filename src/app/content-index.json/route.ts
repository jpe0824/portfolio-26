import { manifest } from "@/content/manifest";
import { allFiles } from "@/content/resolve";
import { readContentFile } from "@/lib/read-content";
import { rendererFor } from "@/lib/renderer-map";

// Prerendered at build time. Without this a GET handler is dynamic, which would
// put a runtime filesystem read on a site that is otherwise fully static.
// See node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md:51
export const dynamic = "force-static";

export async function GET() {
  const index: Record<string, string> = {};

  for (const file of allFiles(manifest)) {
    if (rendererFor(file.name) === "image") continue;
    index[file.source] = await readContentFile(file.source);
  }

  return Response.json(index);
}
