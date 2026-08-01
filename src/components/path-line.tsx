export function PathLine({ path }: { path: string }) {
  return (
    <div className="hidden shrink-0 items-baseline gap-2 border-b border-edge px-4 py-2 md:flex">
      <span className="text-cyan">~/portfolio-26{path ? `/${path}` : ""}</span>
      <span className="text-fg-subtle" aria-hidden="true">
        git:(
        <span className="text-green">main</span>)
      </span>
    </div>
  );
}
