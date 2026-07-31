import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "src", "content", "files");

export async function readContentFile(source: string): Promise<string> {
  const resolved = path.join(ROOT, source);
  if (!resolved.startsWith(ROOT)) throw new Error(`Refusing to read outside content root: ${source}`);
  return readFile(resolved, "utf8");
}
