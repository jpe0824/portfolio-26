import { describe, expect, it } from "vitest";
import { resolveArg, resolvePath } from "@/lib/commands/resolve-path";
import { listDir } from "@/content/resolve";
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
        kind: "dir",
        name: "personal",
        path: "projects/personal",
        title: "personal",
        children: [
          {
            kind: "file",
            name: "1kout.md",
            path: "projects/personal/1kout",
            source: "projects/personal/1kout.md",
            title: "1kout",
          },
        ],
      },
    ],
  },
];

describe("resolvePath", () => {
  it("resolves a relative path against cwd", () => {
    expect(resolvePath("personal", "projects")).toBe("projects/personal");
  });

  it("resolves an absolute path regardless of cwd", () => {
    expect(resolvePath("/whoami", "projects/personal")).toBe("whoami");
  });

  it("treats ~ as the content root", () => {
    expect(resolvePath("~/projects", "projects/personal")).toBe("projects");
  });

  it("resolves ~ alone to the root", () => {
    expect(resolvePath("~", "projects")).toBe("");
  });

  it("walks up with ..", () => {
    expect(resolvePath("..", "projects/personal")).toBe("projects");
  });

  it("clamps at the root rather than escaping it", () => {
    expect(resolvePath("../../../../etc", "projects")).toBe("etc");
    expect(resolvePath("../..", "projects")).toBe("");
  });

  it("ignores . segments and trailing slashes", () => {
    expect(resolvePath("./personal/", "projects")).toBe("projects/personal");
  });

  it("returns cwd for empty input", () => {
    expect(resolvePath("", "projects")).toBe("projects");
  });
});

describe("listDir", () => {
  it("lists the root as the top-level nodes", () => {
    expect(listDir(fixture, "")?.map((n) => n.name)).toEqual(["whoami.md", "projects"]);
  });

  it("lists a nested directory", () => {
    expect(listDir(fixture, "projects")?.map((n) => n.name)).toEqual(["personal"]);
  });

  it("returns null for a file", () => {
    expect(listDir(fixture, "whoami")).toBeNull();
  });

  it("returns null for an unknown path", () => {
    expect(listDir(fixture, "nope")).toBeNull();
  });
});

describe("resolveArg", () => {
  it("resolves by route path", () => {
    expect(resolveArg(fixture, "whoami", "")?.name).toBe("whoami.md");
  });

  it("resolves by file name with its extension", () => {
    expect(resolveArg(fixture, "whoami.md", "")?.name).toBe("whoami.md");
  });

  it("resolves a name relative to cwd", () => {
    expect(resolveArg(fixture, "1kout.md", "projects/personal")?.name).toBe("1kout.md");
  });

  it("resolves a directory with a trailing slash", () => {
    expect(resolveArg(fixture, "projects/", "")?.kind).toBe("dir");
  });

  it("returns null when nothing matches", () => {
    expect(resolveArg(fixture, "nope.md", "")).toBeNull();
  });
});
