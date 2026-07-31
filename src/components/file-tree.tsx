import Link from "next/link";
import type { ContentNode } from "@/content/manifest";
import { FileIcon } from "./file-icon";

const ROW = "flex items-center gap-2 rounded px-2 py-1 hover:bg-elevated";

function isAncestor(dirPath: string, currentPath: string) {
  return currentPath === dirPath || currentPath.startsWith(`${dirPath}/`);
}

export function FileTree({
  nodes,
  currentPath,
  depth = 0,
}: {
  nodes: ContentNode[];
  currentPath: string;
  depth?: number;
}) {
  return (
    <ul className="list-none" style={{ paddingLeft: depth === 0 ? 0 : 12 }}>
      {nodes.map((node) => {
        if (node.kind === "file") {
          const active = node.path === currentPath;
          return (
            <li key={node.path || "root"}>
              <Link
                href={`/${node.path}`}
                aria-current={active ? "page" : undefined}
                className={`${ROW} ${active ? "bg-primary-dim text-fg" : "text-fg-muted"}`}
              >
                <span className="inline-block w-3 shrink-0" aria-hidden="true" />
                <FileIcon name={node.name} />
                <span className="truncate">{node.name}</span>
              </Link>
            </li>
          );
        }

        return (
          <li key={node.path}>
            <details className="group" open={isAncestor(node.path, currentPath)}>
              <summary className={`${ROW} cursor-pointer list-none text-fg-muted marker:content-none`}>
                <span
                  className="inline-block w-3 shrink-0 text-center text-fg-subtle transition-transform group-open:rotate-90"
                  aria-hidden="true"
                >
                  ▸
                </span>
                <FileIcon name={node.name} isDir />
                <span className="truncate">{node.name}/</span>
              </summary>
              {node.children.length > 0 ? (
                <FileTree nodes={node.children} currentPath={currentPath} depth={depth + 1} />
              ) : (
                <p className="pl-11 text-fg-muted">(empty)</p>
              )}
            </details>
          </li>
        );
      })}
    </ul>
  );
}
