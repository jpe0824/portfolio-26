import { manifest } from "@/content/manifest";
import { FileTree } from "./file-tree";

export function FileExplorer({ currentPath }: { currentPath: string }) {
  return (
    <nav
      aria-label="File explorer"
      className="hidden w-60 shrink-0 overflow-auto border-r border-edge bg-panel p-2 md:block"
    >
      <p className="px-2 py-1 text-fg-subtle" aria-hidden="true">
        EXPLORER
      </p>
      <FileTree nodes={manifest} currentPath={currentPath} />
    </nav>
  );
}
