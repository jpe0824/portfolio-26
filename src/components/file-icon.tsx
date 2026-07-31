import { rendererFor } from "@/lib/renderer-map";

const COLORS: Record<string, string> = {
  markdown: "text-primary",
  json: "text-amber",
  log: "text-green",
  image: "text-violet",
  text: "text-fg-subtle",
};

export function FileIcon({ name, isDir = false }: { name: string; isDir?: boolean }) {
  const tone = isDir ? "text-cyan" : COLORS[rendererFor(name)];

  return (
    <svg
      viewBox="0 0 16 16"
      className={`size-4 shrink-0 ${tone}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      {isDir ? (
        <path d="M1.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h5.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1z" />
      ) : (
        <>
          <path d="M3.5 1.5h6l3 3v10h-9z" />
          <path d="M9.5 1.5v3h3" />
        </>
      )}
    </svg>
  );
}
