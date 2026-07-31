export function ImageFile({ name, source }: { name: string; source: string }) {
  return (
    <div className="p-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG assets gain nothing from next/image optimization */}
      <img
        src={`/${source.split("/").pop()}`}
        alt={name}
        className="max-w-full border border-edge bg-elevated"
      />
      <p className="mt-2 text-fg-muted">{name}</p>
    </div>
  );
}
