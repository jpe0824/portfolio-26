import { describe, expect, it } from "vitest";
import { readContentFile } from "@/lib/read-content";

describe("readContentFile", () => {
  it("resolves a legitimate nested source", async () => {
    await expect(readContentFile("assets/je-mark.svg")).resolves.toContain("<svg");
  });

  it("refuses a sibling directory that string-prefixes the root", async () => {
    await expect(readContentFile("../files-evil/secret.txt")).rejects.toThrow(
      /Refusing to read outside content root/,
    );
  });

  it("refuses a source that escapes the root entirely", async () => {
    await expect(readContentFile("../../etc/passwd")).rejects.toThrow(
      /Refusing to read outside content root/,
    );
  });
});
