import { describe, expect, it } from "vitest";
import { tokenizeJsonLine } from "@/lib/tokenize-json";

const kinds = (line: string) => tokenizeJsonLine(line).filter((t) => t.kind !== "space").map((t) => t.kind);

describe("tokenizeJsonLine", () => {
  it("marks a quoted name followed by a colon as a key", () => {
    expect(kinds('"name": "jason"')).toEqual(["key", "punct", "string"]);
  });

  it("distinguishes numbers", () => {
    expect(kinds('"count": 42')).toEqual(["key", "punct", "number"]);
  });

  it("handles negative and exponent numbers", () => {
    expect(kinds("-1.5e10")).toEqual(["number"]);
  });

  it("recognises booleans and null", () => {
    expect(kinds("true")).toEqual(["boolean"]);
    expect(kinds("null")).toEqual(["null"]);
  });

  it("recognises structural punctuation", () => {
    expect(kinds("{")).toEqual(["punct"]);
    expect(kinds("],")).toEqual(["punct", "punct"]);
  });

  it("treats a bare quoted value as a string, not a key", () => {
    expect(kinds('"standalone"')).toEqual(["string"]);
  });

  it("preserves the original text exactly", () => {
    const line = '  "a": [1, true]';
    expect(tokenizeJsonLine(line).map((t) => t.text).join("")).toBe(line);
  });

  it("handles escaped quotes inside strings", () => {
    expect(kinds('"say \\"hi\\""')).toEqual(["string"]);
  });
});
