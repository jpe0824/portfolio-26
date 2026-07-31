"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { manifest } from "@/content/manifest";
import { FileTree } from "./file-tree";

export function MobileNavDrawer({ currentPath }: { currentPath: string }) {
  const [open, setOpen] = useState(false);
  const summaryRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  // Soft navigation preserves the layout, so the drawer must be closed explicitly.
  // Adjusted during render (not in an effect) per React's "adjusting state when
  // a prop changes" guidance — avoids an extra render pass and satisfies
  // react-hooks/set-state-in-effect.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      summaryRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      className="border-b border-edge bg-panel md:hidden"
    >
      <summary
        ref={summaryRef}
        className="cursor-pointer list-none px-3 py-2 text-fg-muted marker:content-none"
        aria-label="Toggle file explorer"
      >
        <span aria-hidden="true">≡ </span>
        <span className="text-cyan">~/portfolio-26</span>
      </summary>
      <nav aria-label="Files" className="max-h-[60dvh] overflow-auto border-t border-edge p-2">
        <FileTree nodes={manifest} currentPath={currentPath} />
      </nav>
    </details>
  );
}
