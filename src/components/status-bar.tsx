export function StatusBar() {
  return (
    <div
      className="flex h-7 shrink-0 items-center gap-4 border-t border-edge bg-panel px-3 text-fg-subtle"
      aria-hidden="true"
    >
      <span className="text-primary">portfolio-26</span>
      <span>main</span>
      <span className="ml-auto">jason-edman v0.1</span>
    </div>
  );
}
