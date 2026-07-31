import { PathLine } from "./path-line";
import { StatusBar } from "./status-bar";
import { ChipRow } from "./chip-row";
import { TopBar } from "./top-bar";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { FileTree } from "./file-tree";
import { manifest } from "@/content/manifest";

export function TerminalFrame({
  explorer,
  currentPath,
  children,
}: {
  explorer: React.ReactNode;
  currentPath: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <a
        href="#file-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-elevated focus:px-3 focus:py-1 focus:text-primary-hi"
      >
        Skip to content
      </a>
      <TopBar />
      <MobileNavDrawer>
        <FileTree nodes={manifest} currentPath={currentPath} />
      </MobileNavDrawer>
      <div className="flex min-h-0 flex-1">
        {explorer}
        <main id="file-content" className="flex min-w-0 flex-1 flex-col">
          <PathLine path={currentPath} />
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </main>
      </div>
      <StatusBar />
      <ChipRow />
    </div>
  );
}
