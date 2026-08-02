import { describe, expect, it } from "vitest";
import { citeSegments } from "@/lib/ai/cite";
import type { ContentNode } from "@/content/manifest";

const fixture: ContentNode[] = [
  { kind: "file", name: "whoami.md", path: "whoami", source: "whoami.md", title: "whoami" },
  {
    kind: "dir",
    name: "projects",
    path: "projects",
    title: "projects",
    children: [
      {
        kind: "file",
        name: "migration.md",
        path: "projects/professional/migration",
        source: "projects/professional/migration.md",
        title: "migration",
      },
    ],
  },
];

const rejoin = (line: string) =>
  citeSegments(line, fixture)
    .map((segment) => segment.text)
    .join("");

describe("citeSegments", () => {
  it("links a known nested path", () => {
    expect(citeSegments("See projects/professional/migration.md for it.", fixture)).toEqual([
      { text: "See " },
      { text: "projects/professional/migration.md", href: "/projects/professional/migration" },
      { text: " for it." },
    ]);
  });

  it("links a known top-level file", () => {
    expect(citeSegments("whoami.md covers it", fixture)).toEqual([
      { text: "whoami.md", href: "/whoami" },
      { text: " covers it" },
    ]);
  });

  it("leaves an unknown path as plain text", () => {
    // The hallucination case: the model invents a file, and it renders inert
    // rather than becoming a link to a route that does not exist.
    expect(citeSegments("See projects/kubernetes.md for it.", fixture)).toEqual([
      { text: "See projects/kubernetes.md for it." },
    ]);
  });

  it("links multiple paths in one line", () => {
    expect(citeSegments("whoami.md and projects/professional/migration.md", fixture)).toEqual([
      { text: "whoami.md", href: "/whoami" },
      { text: " and " },
      { text: "projects/professional/migration.md", href: "/projects/professional/migration" },
    ]);
  });

  it("returns a single plain segment for a line with no paths", () => {
    expect(citeSegments("He works in Python and FastAPI.", fixture)).toEqual([
      { text: "He works in Python and FastAPI." },
    ]);
  });

  it("returns no segments for an empty line", () => {
    expect(citeSegments("", fixture)).toEqual([]);
  });

  it("holds the join invariant for every case", () => {
    // Same invariant tokenize-json.ts holds: segment text concatenated must
    // reproduce the input exactly, or rendering silently drops characters.
    for (const line of [
      "See projects/professional/migration.md for it.",
      "whoami.md and projects/professional/migration.md",
      "no paths at all",
      "projects/kubernetes.md",
      "",
      "whoami.md",
    ]) {
      expect(rejoin(line), line).toBe(line);
    }
  });
});
