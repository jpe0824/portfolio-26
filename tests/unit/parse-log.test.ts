import { describe, expect, it } from "vitest";
import { parseLogLine } from "@/lib/parse-log";

describe("parseLogLine", () => {
  it("splits timestamp, level, and message", () => {
    expect(parseLogLine("[2024-03-01] SHIPPED built the thing")).toEqual({
      timestamp: "2024-03-01",
      level: "SHIPPED",
      message: "built the thing",
    });
  });

  it("returns the whole line as the message when unstructured", () => {
    expect(parseLogLine("just a line")).toEqual({
      timestamp: null,
      level: null,
      message: "just a line",
    });
  });

  it("handles an empty line", () => {
    expect(parseLogLine("")).toEqual({ timestamp: null, level: null, message: "" });
  });
});
