import type { ContentNode } from "@/content/manifest";
import { rendererFor } from "@/lib/renderer-map";
import { readContentFile } from "@/lib/read-content";
import { DirectoryListing } from "./directory-listing";
import { ImageFile } from "./image-file";
import { JsonFile } from "./json-file";
import { LogFile } from "./log-file";
import { MarkdownFile } from "./markdown-file";
import { TextFile } from "./text-file";

export async function FileViewport({ node }: { node: ContentNode }) {
  if (node.kind === "dir") return <DirectoryListing node={node} />;

  const kind = rendererFor(node.name);
  if (kind === "image") return <ImageFile name={node.name} source={node.source} />;

  const source = await readContentFile(node.source);

  switch (kind) {
    case "markdown":
      return <MarkdownFile source={source} />;
    case "json":
      return <JsonFile source={source} />;
    case "log":
      return <LogFile source={source} />;
    default:
      return <TextFile source={source} />;
  }
}
