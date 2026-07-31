export function LineRow({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="w-10 shrink-0 select-none text-right text-fg-subtle" aria-hidden="true">
        {n}
      </span>
      <span className="min-w-0 whitespace-pre-wrap break-words">{children}</span>
    </div>
  );
}
