export default function Probe() {
  return (
    <main className="p-8">
      <p className="text-fg">fg — body text</p>
      <p className="text-fg-muted">fg-muted — secondary</p>
      <p className="text-fg-subtle">fg-subtle — decorative only</p>
      <p className="text-primary">primary — dodgerblue #1E90FF</p>
      <p className="text-cyan">cyan</p>
      <p className="text-violet">violet</p>
      <p className="text-green">green</p>
      <p className="text-amber">amber</p>
      <p className="text-red">red</p>
      <div className="mt-4 border border-edge bg-panel p-4">panel on base, edge border</div>
    </main>
  );
}
