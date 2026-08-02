"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { FileTree } from "./file-tree";
import { manifest } from "@/content/manifest";

export function MobileNavDrawer() {
  const [open, setOpen] = useState(false);
  const summaryRef = useRef<HTMLElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  const isFirstPathnameEffect = useRef(true);

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

  // This repo's no-JS requirement means a visitor can open the drawer — a plain, uncontrolled
  // <details> — before this component ever hydrates. When that happens, the DOM's `open`
  // attribute is true but React's `open` state is still its initial `false`, because the native
  // `toggle` event that would have told React about it (see below) never had a listener yet.
  // The line above's `setOpen(false)` is then a genuine no-op — state already matches — so it
  // cannot force the real, already-open element closed on the next navigation. This effect
  // covers that gap directly, on the actual DOM node, independent of what React believes `open`
  // is. The first-run guard matters: without it, this would also fire on mount and slam shut a
  // drawer a visitor legitimately just opened pre-hydration, before they had any chance to use
  // it — the fix is for an actual *navigation* while mounted, not for hydration itself.
  useEffect(() => {
    if (isFirstPathnameEffect.current) {
      isFirstPathnameEffect.current = false;
      return;
    }
    if (detailsRef.current) detailsRef.current.open = false;
  }, [pathname]);

  // Attached once, at mount, rather than gated on `open` (as an earlier version did): per the
  // HTML spec, <details>'s `toggle` event is dispatched asynchronously as a separate queued
  // task, not synchronously within the click that caused it — so the effect that used to run
  // `if (!open) return` and attach from there could lag the DOM's own, already-visible change by
  // tens of milliseconds (measured directly), a real window in which a fast Escape press was
  // silently lost. Reading `detailsRef.current.open` directly from the DOM instead of trusting
  // React's `open` state also closes the pre-hydration case above: if the drawer was opened
  // natively before hydration, the DOM already says `open`, and this listener — live from the
  // first render onward — honors that regardless of what `open` state (still `false`) claims.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const el = detailsRef.current;
      if (!el?.open) return;
      el.open = false;
      setOpen(false);
      summaryRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const currentPath = pathname === "/" ? "" : pathname.slice(1);

  return (
    <details
      ref={detailsRef}
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
