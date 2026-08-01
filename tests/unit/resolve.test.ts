import { describe, expect, it } from "vitest";
import { allFiles, allPaths, resolveNode } from "@/content/resolve";
import type { ContentNode } from "@/content/manifest";

const fixture: ContentNode[] = [
  { kind: "file", name: "README.md", path: "readme", source: "README.md", title: "README" },
  { kind: "file", name: "whoami.md", path: "whoami", source: "whoami.md", title: "whoami" },
  {
    kind: "dir",
    name: "projects",
    path: "projects",
    title: "projects",
    children: [
      { kind: "file", name: "alpha.md", path: "projects/alpha", source: "projects/alpha.md", title: "alpha" },
    ],
  },
];

describe("resolveNode", () => {
  it("returns null for the root, which is no longer a content node", () => {
    expect(resolveNode(fixture, [])).toBeNull();
  });

  it("resolves README at its own path", () => {
    expect(resolveNode(fixture, ["readme"])?.name).toBe("README.md");
  });

  it("resolves a top-level file", () => {
    expect(resolveNode(fixture, ["whoami"])?.name).toBe("whoami.md");
  });

  it("resolves a nested file", () => {
    expect(resolveNode(fixture, ["projects", "alpha"])?.name).toBe("alpha.md");
  });

  it("resolves a directory", () => {
    const hit = resolveNode(fixture, ["projects"]);
    expect(hit?.kind).toBe("dir");
  });

  it("returns null for an unknown path", () => {
    expect(resolveNode(fixture, ["nope"])).toBeNull();
  });

  it("returns null for a partial match, not a prefix hit", () => {
    expect(resolveNode(fixture, ["projects", "missing"])).toBeNull();
  });
});

describe("allPaths", () => {
  it("includes every file and directory path", () => {
    expect(allPaths(fixture).sort()).toEqual(["projects", "projects/alpha", "readme", "whoami"]);
  });
});

describe("allFiles", () => {
  it("returns every file node and no directories", () => {
    expect(allFiles(fixture).map((f) => f.source).sort()).toEqual([
      "README.md",
      "projects/alpha.md",
      "whoami.md",
    ]);
  });
});
