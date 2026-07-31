export type RendererKind = "markdown" | "json" | "log" | "image" | "text";

const IMAGE_EXTENSIONS = new Set(["svg", "png", "jpg", "jpeg", "webp", "gif", "avif"]);

export function rendererFor(name: string): RendererKind {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "text";
  const ext = name.slice(dot + 1).toLowerCase();

  if (ext === "md") return "markdown";
  if (ext === "json") return "json";
  if (ext === "log") return "log";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  return "text";
}
