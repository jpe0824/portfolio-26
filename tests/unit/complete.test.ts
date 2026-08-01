import { describe, expect, it } from "vitest";
import { complete } from "@/lib/commands/complete";
import type { CommandContext } from "@/lib/commands/types";
import type { ContentNode } from "@/content/manifest";

const fixture: ContentNode[] = [
  { kind: "file", name: "whoami.md", path: "whoami", source: "whoami.md", title: "whoami" },
  { kind: "file", name: "stack.json", path: "stack", source: "stack.json", title: "stack" },
  {
    kind: "dir",
    name: "projects",
    path: "projects",
    title: "projects",
    children: [
      { kind: "dir", name: "personal", path: "projects/personal", title: "personal", children: [] },
      { kind: "dir", name: "professional", path: "projects/professional", title: "professional", children: [] },
    ],
  },
];

const ctx = (cwd = ""): CommandContext => ({
  cwd,
  manifest: fixture,
  readFile: async () => "",
  grep: async () => [],
});

describe("complete", () => {
  it("completes a unique command name", () => {
    expect(complete("gr", ctx())).toEqual({ completed: "grep ", candidates: [] });
  });

  it("completes a unique slash command", () => {
    expect(complete("/co", ctx())).toEqual({ completed: "/contact ", candidates: [] });
  });

  it("extends to the common prefix and lists ambiguous commands", () => {
    const result = complete("c", ctx());
    expect(result.completed).toBe("c");
    expect(result.candidates).toEqual(["cd", "cat", "close", "clear"]);
  });

  it("completes a unique file argument", () => {
    expect(complete("cat wh", ctx())).toEqual({ completed: "cat whoami.md ", candidates: [] });
  });

  it("appends a slash to a completed directory", () => {
    expect(complete("cd proj", ctx())).toEqual({ completed: "cd projects/", candidates: [] });
  });

  it("extends to the common prefix inside a directory", () => {
    const result = complete("cd projects/p", ctx());
    expect(result.completed).toBe("cd projects/p");
    expect(result.candidates).toEqual(["personal/", "professional/"]);
  });

  it("extends an ambiguous directory listing without resolving it", () => {
    // Second Tab on "cd projects/": both children match the empty stem, but
    // they share a longer prefix ("p") than what's typed (""), so this hits
    // the extend-without-resolving branch — completed grows, candidates stay empty.
    expect(complete("cd projects/", ctx())).toEqual({
      completed: "cd projects/p",
      candidates: [],
    });
  });

  it("completes relative to cwd", () => {
    expect(complete("cd pers", ctx("projects"))).toEqual({
      completed: "cd personal/",
      candidates: [],
    });
  });

  it("returns the input unchanged when nothing matches", () => {
    expect(complete("cat zzz", ctx())).toEqual({ completed: "cat zzz", candidates: [] });
  });

  it("leaves empty input alone", () => {
    expect(complete("", ctx())).toEqual({ completed: "", candidates: [] });
  });

  it("completes a unique command despite leading whitespace", () => {
    // A leading space means nothing precedes the active token, so this is
    // still the first (command) position — not a path argument.
    expect(complete(" ls", ctx())).toEqual({ completed: " ls ", candidates: [] });
  });

  it("lists ambiguous commands despite leading whitespace, preserving it", () => {
    expect(complete(" c", ctx())).toEqual({
      completed: " c",
      candidates: ["cd", "cat", "close", "clear"],
    });
  });
});
