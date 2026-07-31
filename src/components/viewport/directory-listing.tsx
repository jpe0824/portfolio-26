import Link from "next/link";
import type { DirNode } from "@/content/manifest";
import { FileIcon } from "../file-icon";

export function DirectoryListing({ node }: { node: DirNode }) {
  if (node.children.length === 0) {
    return (
      <div className="p-4 text-fg-muted">
        <p>{node.name}/ is empty.</p>
        <p className="mt-2 text-fg-muted">Nothing written here yet.</p>
      </div>
    );
  }

  return (
    <ul className="list-none p-4">
      {node.children.map((child) => (
        <li key={child.path}>
          <Link
            href={`/${child.path}`}
            className="flex items-center gap-2 rounded px-2 py-1 text-fg-muted hover:bg-elevated"
          >
            <FileIcon name={child.name} isDir={child.kind === "dir"} />
            <span>{child.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
