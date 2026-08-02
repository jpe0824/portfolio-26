import { describe, expect, it } from "vitest";
import { createRedactor, redactText } from "@/lib/ai/redact";

describe("redactText", () => {
  it("replaces the full name in subject position", () => {
    expect(redactText("Jason Edman built the edge stack.")).toBe("He built the edge stack.");
  });

  it("replaces the bare first name", () => {
    expect(redactText("Jason works in Python.")).toBe("He works in Python.");
  });

  it("lowercases the pronoun mid-sentence", () => {
    expect(redactText("The site belongs to Jason Edman.")).toBe("The site belongs to he.");
  });

  it("turns a possessive into his", () => {
    expect(redactText("Jason's homelab runs Proxmox.")).toBe("His homelab runs Proxmox.");
  });

  it("turns a mid-sentence possessive into lowercase his", () => {
    expect(redactText("that is Jason's call")).toBe("that is his call");
  });

  it("handles a typographic apostrophe", () => {
    expect(redactText("Jason’s stack")).toBe("His stack");
  });

  it("leaves the name inside a URL untouched", () => {
    // \bJason\b cannot match inside "jasonedman" — the next character is a word
    // character, so there is no boundary. This is why URLs need no special case.
    const url = "https://www.linkedin.com/in/jasonedman/";
    expect(redactText(url)).toBe(url);
  });

  it("leaves the site domain untouched", () => {
    expect(redactText("Deployed at jsonedman.dev")).toBe("Deployed at jsonedman.dev");
  });

  it("does not match a longer word that merely starts with the name", () => {
    expect(redactText("Jasonville is a place")).toBe("Jasonville is a place");
  });

  it("replaces every occurrence in a line", () => {
    expect(redactText("Jason wrote it. Jason Edman shipped it.")).toBe("He wrote it. He shipped it.");
  });

  it("collapses extra whitespace inside the full name", () => {
    expect(redactText("Jason  Edman ships")).toBe("He ships");
  });
});

describe("createRedactor", () => {
  function run(chunks: string[]): string {
    const redactor = createRedactor();
    return chunks.map((chunk) => redactor.push(chunk)).join("") + redactor.flush();
  }

  it("redacts a name delivered in one chunk", () => {
    expect(run(["Jason Edman ships things."])).toBe("He ships things.");
  });

  it("redacts a name split across two chunks", () => {
    // The failure this whole buffering scheme exists for: an unbuffered filter
    // sees "Jas" and "on Edman" separately, matches neither, and emits the name.
    expect(run(["He is Jas", "on Edman, an engineer."])).toBe("He is he, an engineer.");
  });

  it("redacts a name split at every possible offset", () => {
    const source = "The engineer Jason Edman wrote it.";
    const expected = "The engineer he wrote it.";
    for (let cut = 0; cut <= source.length; cut++) {
      expect(run([source.slice(0, cut), source.slice(cut)]), `cut at ${cut}`).toBe(expected);
    }
  });

  it("redacts a name arriving one character at a time", () => {
    expect(run([..."Ask Jason Edman about it."])).toBe("Ask he about it.");
  });

  it("passes through text containing no name", () => {
    expect(run(["Python and ", "FastAPI, ", "MongoDB."])).toBe("Python and FastAPI, MongoDB.");
  });

  it("emits nothing beyond the held tail before flush", () => {
    const redactor = createRedactor();
    const emitted = redactor.push("He is Jason");
    // "Jason" could still grow into "Jason Edman", so it must not be emitted yet.
    expect(emitted).not.toContain("Jason");
    expect(emitted + redactor.flush()).toBe("He is he");
  });

  it("redacts a name split across an unbounded whitespace gap", () => {
    // The fixed 32-char WINDOW was insufficient: a large gap between "Jason" and "Edman"
    // would cause the surname to leak. This tests that the new unbounded-scan approach
    // catches the name no matter how wide the gap.
    const source = "Text with Jason" + " ".repeat(40) + "Edman finished.";
    const expected = "Text with he finished.";
    expect(run([source.slice(0, 20), source.slice(20)])).toBe(expected);
  });

  it("reproduces the input exactly when nothing matches, across many chunks", () => {
    const source = "A terminal portfolio with a grounded chat mode. No names here at all.";
    const chunks = source.match(/.{1,3}/g) ?? [];
    expect(run(chunks)).toBe(source);
  });
});
