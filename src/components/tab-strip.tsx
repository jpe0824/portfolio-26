import Link from "next/link";
import type { ContentNode } from "@/content/manifest";
import { FileIcon } from "./file-icon";

export function TabStrip({ node }: { node: ContentNode }) {
  const label = node.kind === "dir" ? `${node.name}/` : node.name;

  return (
    <div className="flex h-8 shrink-0 items-stretch border-b border-edge bg-panel">
      <div className="flex items-center gap-2 border-r border-edge bg-base px-3">
        <FileIcon name={node.name} isDir={node.kind === "dir"} />
        <span className="truncate text-fg">{label}</span>
        <Link
          href="/"
          aria-label={`Close ${label}`}
          className="ml-1 rounded px-1 text-fg-muted hover:bg-elevated hover:text-fg"
        >
          <span aria-hidden="true">✕</span>
        </Link>
      </div>
    </div>
  );
}
