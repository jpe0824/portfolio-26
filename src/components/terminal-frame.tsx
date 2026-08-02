import { StatusBar } from "./status-bar";
import { TopBar } from "./top-bar";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { CommandSurface } from "./terminal/command-surface";
import { TerminalPanel } from "./terminal/terminal-panel";

export function TerminalFrame({
  explorer,
  children,
}: {
  explorer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <CommandSurface>
      <div className="flex h-[100dvh] flex-col overflow-hidden">
        <a
          href="#file-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-elevated focus:px-3 focus:py-1 focus:text-primary-hi"
        >
          Skip to content
        </a>
        <TopBar />
        <MobileNavDrawer />
        <div className="flex min-h-0 flex-1">
          {explorer}
          {/* Content column. TerminalPanel is a sibling of <main>, deliberately outside it
              so getByRole("main") stays a clean content scope for the rest of the suite. */}
          <div className="flex min-w-0 flex-1 flex-col">
            <main id="file-content" className="flex min-h-0 flex-1 flex-col">
              {children}
            </main>
            <TerminalPanel />
          </div>
        </div>
        <StatusBar />
      </div>
    </CommandSurface>
  );
}
