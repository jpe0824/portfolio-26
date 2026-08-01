import { describe, expect, it } from "vitest";
import { runCommand } from "@/lib/commands/run";
import { commands, UNKNOWN_INPUT } from "@/lib/commands/registry";
import type { CommandContext } from "@/lib/commands/types";
import type { ContentNode } from "@/content/manifest";

const fixture: ContentNode[] = [
  { kind: "file", name: "whoami.md", path: "whoami", source: "whoami.md", title: "whoami" },
  {
    kind: "dir",
    name: "projects",
    path: "projects",
    title: "projects",
    children: [
      { kind: "file", name: "1kout.md", path: "projects/1kout", source: "projects/1kout.md", title: "1kout" },
    ],
  },
  {
    kind: "dir",
    name: "assets",
    path: "assets",
    title: "assets",
    // Mirrors the real manifest's assets/je-mark.svg — an image node is required
    // to exercise cat's binary-file guard (rendererFor(...) === "image").
    children: [
      { kind: "file", name: "je-mark.svg", path: "assets/je-mark", source: "assets/je-mark.svg", title: "je-mark" },
    ],
  },
];

function ctx(cwd = ""): CommandContext {
  return {
    cwd,
    manifest: fixture,
    readFile: async (source) => `contents of ${source}`,
    grep: async () => [],
  };
}

const text = (result: Awaited<ReturnType<typeof runCommand>>) =>
  result.kind === "output" ? result.lines.map((l) => l.text) : [];

// Unlike text(), this keeps `tone` in the returned lines so tests can pin it —
// text() strips tone from every assertion in this file, so nothing else here
// would notice tone/text getting out of sync.
function lines(result: Awaited<ReturnType<typeof runCommand>>) {
  if (result.kind !== "output") throw new Error(`expected an output result, got ${result.kind}`);
  return result.lines;
}

describe("runCommand", () => {
  it("returns no output for empty input", async () => {
    expect(text(await runCommand("   ", ctx()))).toEqual([]);
  });

  it("ls lists the root", async () => {
    expect(text(await runCommand("ls", ctx()))).toEqual(["whoami.md", "projects/", "assets/"]);
  });

  it("ls tags directories with accent tone and leaves files untoned", async () => {
    expect(lines(await runCommand("ls", ctx()))).toEqual([
      { text: "whoami.md" },
      { text: "projects/", tone: "accent" },
      { text: "assets/", tone: "accent" },
    ]);
  });

  it("ls lists a named directory", async () => {
    expect(text(await runCommand("ls projects", ctx()))).toEqual(["1kout.md"]);
  });

  it("ls respects cwd", async () => {
    expect(text(await runCommand("ls", ctx("projects")))).toEqual(["1kout.md"]);
  });

  it("ls reports a missing directory", async () => {
    expect(text(await runCommand("ls nope", ctx()))).toEqual([
      "ls: no such file or directory: nope",
    ]);
  });

  it("ls error output carries error tone", async () => {
    expect(lines(await runCommand("ls nope", ctx()))).toEqual([
      { text: "ls: no such file or directory: nope", tone: "error" },
    ]);
  });

  it("cd returns a new cwd without navigating", async () => {
    expect(await runCommand("cd projects", ctx())).toEqual({ kind: "cwd", cwd: "projects" });
  });

  it("cd with no argument returns to the root", async () => {
    expect(await runCommand("cd", ctx("projects"))).toEqual({ kind: "cwd", cwd: "" });
  });

  it("cd refuses a file", async () => {
    // The route-path form ("whoami", no extension) is what resolveNode actually
    // matches against a manifest FileNode — this hits the "found a file, reject
    // it" branch. The extension form ("whoami.md") never resolves at all, which
    // would exercise the missing-path branch below instead, for the wrong reason.
    expect(text(await runCommand("cd whoami", ctx()))).toEqual(["cd: not a directory: whoami"]);
  });

  it("cd reports a missing path", async () => {
    expect(text(await runCommand("cd nope", ctx()))).toEqual(["cd: not a directory: nope"]);
  });

  it("pwd prints the display path", async () => {
    expect(text(await runCommand("pwd", ctx("projects")))).toEqual(["~/portfolio-26/projects"]);
  });

  it("open navigates by name", async () => {
    expect(await runCommand("open whoami.md", ctx())).toEqual({ kind: "navigate", path: "/whoami" });
  });

  it("open navigates by route path", async () => {
    expect(await runCommand("open whoami", ctx())).toEqual({ kind: "navigate", path: "/whoami" });
  });

  it("open reports a missing file", async () => {
    expect(text(await runCommand("open nope", ctx()))).toEqual([
      "open: no such file or directory: nope",
    ]);
  });

  it("open with no argument reports a missing operand", async () => {
    expect(text(await runCommand("open", ctx()))).toEqual(["open: missing operand"]);
  });

  it("close navigates to the root", async () => {
    expect(await runCommand("close", ctx())).toEqual({ kind: "navigate", path: "/" });
  });

  it("clear clears", async () => {
    expect(await runCommand("clear", ctx())).toEqual({ kind: "clear" });
  });

  it("tree draws the whole manifest", async () => {
    expect(text(await runCommand("tree", ctx()))).toEqual([
      "whoami.md",
      "projects/",
      "  1kout.md",
      "assets/",
      "  je-mark.svg",
    ]);
  });

  it("tree preserves tone at depth", async () => {
    expect(lines(await runCommand("tree", ctx()))).toEqual([
      { text: "whoami.md" },
      { text: "projects/", tone: "accent" },
      { text: "  1kout.md" },
      { text: "assets/", tone: "accent" },
      { text: "  je-mark.svg" },
    ]);
  });

  it("help lists every registered command", async () => {
    const lines = text(await runCommand("help", ctx()));
    const listed = lines.map((l) => l.split(/\s{2,}/)[0]);
    expect(listed).toEqual(commands.map((c) => c.name));
  });

  it("routes unrecognized input to the model stub", async () => {
    expect(text(await runCommand("tell me about your homelab", ctx()))).toEqual([UNKNOWN_INPUT]);
    expect(text(await runCommand("sl", ctx()))).toEqual([UNKNOWN_INPUT]);
  });

  it("unknown input line carries dim tone", async () => {
    expect(lines(await runCommand("sl", ctx()))).toEqual([{ text: UNKNOWN_INPUT, tone: "dim" }]);
  });
});

describe("cat and grep", () => {
  it("cat prints file contents line by line", async () => {
    const context = { ...ctx(), readFile: async () => "line one\nline two" };
    expect(text(await runCommand("cat whoami.md", context))).toEqual(["line one", "line two"]);
  });

  it("cat resolves relative to cwd", async () => {
    const seen: string[] = [];
    const context = {
      ...ctx("projects"),
      readFile: async (source: string) => {
        seen.push(source);
        return "ok";
      },
    };
    await runCommand("cat 1kout.md", context);
    expect(seen).toEqual(["projects/1kout.md"]);
  });

  it("cat reports a missing file", async () => {
    expect(text(await runCommand("cat nope", ctx()))).toEqual([
      "cat: no such file or directory: nope",
    ]);
  });

  it("cat refuses a directory", async () => {
    expect(text(await runCommand("cat projects", ctx()))).toEqual([
      "cat: projects: is a directory",
    ]);
  });

  it("cat with no argument reports a missing operand", async () => {
    expect(text(await runCommand("cat", ctx()))).toEqual(["cat: missing operand"]);
  });

  it("cat refuses a binary file and never reads it", async () => {
    // readFile both records every call and throws if invoked, so this proves
    // the image guard short-circuits rather than merely that the message text
    // happens to match what a real read would have produced.
    const seen: string[] = [];
    const context = {
      ...ctx(),
      readFile: async (source: string) => {
        seen.push(source);
        throw new Error("readFile should not be called for a binary file");
      },
    };
    expect(text(await runCommand("cat assets/je-mark.svg", context))).toEqual([
      "cat: je-mark.svg: binary file",
    ]);
    expect(seen).toEqual([]);
  });

  it("grep formats hits as path:line text", async () => {
    const context = {
      ...ctx(),
      grep: async () => [{ path: "whoami.md", line: 3, text: "senior engineer" }],
    };
    expect(text(await runCommand("grep senior", context))).toEqual([
      "whoami.md:3  senior engineer",
    ]);
  });

  it("grep reports no matches", async () => {
    expect(text(await runCommand("grep zzz", ctx()))).toEqual(["grep: no matches for zzz"]);
  });

  it("grep requires a term", async () => {
    expect(text(await runCommand("grep", ctx()))).toEqual(["grep: missing operand"]);
  });
});

describe("slash commands", () => {
  it("/contact navigates to contact", async () => {
    expect(await runCommand("/contact", ctx())).toEqual({ kind: "navigate", path: "/contact" });
  });

  it("/help lists commands, like help", async () => {
    const slash = text(await runCommand("/help", ctx()));
    const plain = text(await runCommand("help", ctx()));
    expect(slash).toEqual(plain);
  });

  it("/ai reports that it is not connected", async () => {
    expect(text(await runCommand("/ai", ctx()))).toEqual(["▸ not connected — phase 2b"]);
  });

  it("/ai output carries dim tone", async () => {
    expect(lines(await runCommand("/ai", ctx()))).toEqual([
      { text: "▸ not connected — phase 2b", tone: "dim" },
    ]);
  });
});
