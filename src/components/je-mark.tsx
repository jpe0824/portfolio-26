export function JeMark({ className }: { className?: string }) {
  return (
    <span className={className} aria-label="jason edman" role="img">
      <span className="text-fg">J</span>
      <span className="text-primary">{"{"}</span>
      <span className="text-fg">E</span>
      <span className="text-primary">{"}"}</span>
    </span>
  );
}
