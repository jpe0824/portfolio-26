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

  it("turns an ASCII-apostrophe possessive into his", () => {
    // "Jason's stack" with U+0027. Written as an escape because this test
    // exists specifically to pin the ASCII form, and a mistyped literal
    // would silently make it a duplicate of the typographic test above.
    expect(redactText("Jason's homelab")).toBe("His homelab");
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

  it("replaces the bare surname on its own", () => {
    // A model shortening to the surname on second reference ("Edman built the edge stack")
    // is ordinary usage, not an exotic case — the full name's optional-Edman branch only
    // ever fires when "Jason" precedes it, so the bare surname needs its own coverage.
    expect(redactText("Edman built the edge stack.")).toBe("He built the edge stack.");
  });

  it("lowercases the pronoun for a mid-sentence bare surname", () => {
    expect(redactText("The site belongs to Edman.")).toBe("The site belongs to he.");
  });

  it("turns a bare-surname possessive into his", () => {
    expect(redactText("Edman's homelab runs Proxmox.")).toBe("His homelab runs Proxmox.");
  });

  it("does not double-redact when the surname follows the full name", () => {
    expect(redactText("Jason Edman wrote it.")).toBe("He wrote it.");
  });

  it("leaves the bare surname inside a URL untouched", () => {
    // Same word-boundary reasoning as the full name above: nothing but a word character
    // ("n", from "jason") precedes "edman" inside this slug.
    const url = "https://www.linkedin.com/in/jasonedman/";
    expect(redactText(url)).toBe(url);
  });

  it("leaves the bare surname inside the site domain untouched", () => {
    // "jsonedman.dev" contains the literal substring "edman", preceded only by "n" (from
    // "json") — a word character, so the standalone-surname alternative cannot start there.
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

  it("redacts a bare surname delivered in one chunk", () => {
    expect(run(["Edman ships things."])).toBe("He ships things.");
  });

  it("redacts a bare surname split across two chunks", () => {
    // Mirrors the full-name split above: an unbuffered filter sees "Ed" and "man" separately
    // and matches neither.
    expect(run(["The engineer Ed", "man wrote it."])).toBe("The engineer he wrote it.");
  });

  it("redacts a bare surname split at every possible offset", () => {
    const source = "The engineer Edman wrote it.";
    const expected = "The engineer he wrote it.";
    for (let cut = 0; cut <= source.length; cut++) {
      expect(run([source.slice(0, cut), source.slice(cut)]), `cut at ${cut}`).toBe(expected);
    }
  });

  it("redacts a bare-surname possessive split across a chunk boundary", () => {
    expect(run(["Edman'", "s stack"])).toBe("His stack");
  });

  it("leaves jsonedman.dev untouched when the chunk boundary falls right after 'json'", () => {
    // The dangerous split: a chunk boundary landing exactly between "json" and "edman" strands
    // "edman" as its own fragment. Without a leading-boundary check in safeCut, the next push
    // would match it in isolation — `\b` at the start of an isolated string cannot tell that a
    // word character ("n") actually preceded it in the original text — and wrongly redact a
    // piece of the site's own domain.
    const source = "Deployed at jsonedman.dev";
    const cut = source.indexOf("edman");
    expect(run([source.slice(0, cut), source.slice(cut)])).toBe(source);
  });

  it("leaves the linkedin slug untouched when the chunk boundary falls right after 'json'", () => {
    const source = "https://www.linkedin.com/in/jasonedman/";
    const cut = source.indexOf("edman");
    expect(run([source.slice(0, cut), source.slice(cut)])).toBe(source);
  });

  it("reproduces the input exactly when nothing matches, across many chunks", () => {
    const source = "A terminal portfolio with a grounded chat mode. No names here at all.";
    const chunks = source.match(/.{1,3}/g) ?? [];
    expect(run(chunks)).toBe(source);
  });

  it("matches possessive with ASCII apostrophe U+0027 across chunk boundary", () => {
    expect(run(["Jason'", "s stack"])).toBe("His stack");
  });
});
