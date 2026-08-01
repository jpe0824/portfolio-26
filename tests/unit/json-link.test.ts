import { describe, expect, it } from "vitest";
import { hrefForJsonString } from "@/lib/json-link";

describe("hrefForJsonString", () => {
  it("returns an http URL unchanged", () => {
    expect(hrefForJsonString('"http://example.com"')).toBe("http://example.com");
  });

  it("returns an https URL unchanged", () => {
    expect(hrefForJsonString('"https://github.com/jpe0824"')).toBe("https://github.com/jpe0824");
  });

  it("returns null for a plain string", () => {
    expect(hrefForJsonString('"Salt Lake City, Utah"')).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(hrefForJsonString("not quoted at all")).toBeNull();
  });

  it("returns null for a string that merely contains a URL", () => {
    expect(hrefForJsonString('"see https://example.com for details"')).toBeNull();
  });

  it("returns null for a bare email address", () => {
    expect(hrefForJsonString('"someone@example.com"')).toBeNull();
  });

  it("rejects non-http(s) schemes such as javascript:", () => {
    expect(hrefForJsonString('"javascript://x%0aalert(1)"')).toBeNull();
  });

  it("rejects protocol-relative values", () => {
    expect(hrefForJsonString('"//example.com"')).toBeNull();
  });
});
