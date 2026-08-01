"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { FileTree } from "./file-tree";
import { manifest } from "@/content/manifest";

export function MobileNavDrawer() {
  const [open, setOpen] = useState(false);
  const summaryRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  // Soft navigation preserves the layout, so the drawer must be closed explicitly.
  // Adjusted during render (not in an effect) per React's "adjusting state when a prop
  // changes" guidance: it avoids a frame of stale open drawer, and the effect form
  // `useEffect(() => setOpen(false), [pathname])` fails this repo's
  // react-hooks/set-state-in-effect rule (error severity via eslint-config-next).
  // This cannot loop: after the update, lastPathname === pathname, so the guard is false.
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

  const currentPath = pathname === "/" ? "" : pathname.slice(1);

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
