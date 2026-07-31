import { describe, expect, it } from "vitest";
import { rendererFor } from "@/lib/renderer-map";

describe("rendererFor", () => {
  it("maps markdown", () => expect(rendererFor("whoami.md")).toBe("markdown"));
  it("maps json", () => expect(rendererFor("stack.json")).toBe("json"));
  it("maps log", () => expect(rendererFor("experience.log")).toBe("log"));
  it("maps svg as image", () => expect(rendererFor("je-mark.svg")).toBe("image"));
  it("maps png as image", () => expect(rendererFor("shot.png")).toBe("image"));
  it("is case-insensitive", () => expect(rendererFor("READ.MD")).toBe("markdown"));
  it("falls back to text for unknown extensions", () => expect(rendererFor("notes.xyz")).toBe("text"));
  it("falls back to text when there is no extension", () => expect(rendererFor("LICENSE")).toBe("text"));
  it("uses the last extension only", () => expect(rendererFor("a.md.json")).toBe("json"));
});
