import { describe, expect, it } from "vitest";
import { buildSystemPrompt, RULES } from "@/lib/ai/system-prompt";
import { manifest } from "@/content/manifest";
import type { ContentNode } from "@/content/manifest";

const fixture: ContentNode[] = [
  { kind: "file", name: "whoami.md", path: "whoami", source: "whoami.md", title: "whoami" },
  {
    kind: "dir",
    name: "assets",
    path: "assets",
    title: "assets",
    children: [
      { kind: "file", name: "je-mark.svg", path: "assets/je-mark", source: "assets/je-mark.svg", title: "je-mark" },
    ],
  },
];

const reader = async (source: string) => `contents of ${source}`;

describe("buildSystemPrompt", () => {
  it("includes the rules", async () => {
    expect(await buildSystemPrompt(fixture, reader)).toContain(RULES);
  });

  it("delimits each file by its manifest source path", async () => {
    const prompt = await buildSystemPrompt(fixture, reader);
    expect(prompt).toContain('<file path="whoami.md">');
    expect(prompt).toContain("contents of whoami.md");
    expect(prompt).toContain("</file>");
  });

  it("skips images and never reads them", async () => {
    // An SVG's markup is noise in a prompt and would burn tokens for nothing.
    // The reader throws so this proves the guard short-circuits rather than
    // merely that the output happens not to show the file.
    const seen: string[] = [];
    const strict = async (source: string) => {
      seen.push(source);
      if (source.endsWith(".svg")) throw new Error("should not read an image");
      return "ok";
    };
    const prompt = await buildSystemPrompt(fixture, strict);
    expect(seen).toEqual(["whoami.md"]);
    expect(prompt).not.toContain("je-mark.svg");
  });

  it("instructs the model never to use the name", async () => {
    expect(RULES.toLowerCase()).toContain("never");
    expect(RULES).toMatch(/name/i);
  });

  it("covers every non-image file in the real manifest", async () => {
    const prompt = await buildSystemPrompt(manifest, reader);
    for (const source of [
      "README.md",
      "whoami.md",
      "experience.log",
      "stack.json",
      "favorites.json",
      "contact.json",
      "projects/personal/1kout.md",
      "projects/professional/migration.md",
    ]) {
      expect(prompt, source).toContain(`<file path="${source}">`);
    }
  });

  it("stays small enough to inline on every request", async () => {
    // The whole design rests on the corpus fitting in a prompt (spec D4). If this
    // ever fails, the retrieval question genuinely reopens — it is not a nuisance
    // threshold to raise.
    const prompt = await buildSystemPrompt(manifest, async () => "x".repeat(200));
    expect(prompt.length).toBeLessThan(40_000);
  });
});
