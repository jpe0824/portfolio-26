export type JsonTokenKind =
  | "key"
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "punct"
  | "space"
  /** Fallback for malformed input, so join("") === line always holds. */
  | "text";

export type JsonToken = { text: string; kind: JsonTokenKind };

const PATTERN = new RegExp(
  [
    '("(?:\\\\.|[^"\\\\])*")(\\s*:)?', // 1: quoted run, 2: optional colon => key
    "(-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)", // 3: number
    "\\b(true|false)\\b", // 4: boolean
    "\\b(null)\\b", // 5: null
    "([{}\\[\\],:])", // 6: punctuation
    "(\\s+)", // 7: whitespace
    "([^\\s]+)", // 8: anything else, kept verbatim
  ].join("|"),
  "g",
);

export function tokenizeJsonLine(line: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  for (const match of line.matchAll(PATTERN)) {
    const [, quoted, colon, num, bool, nul, punct, space] = match;

    if (quoted !== undefined) {
      tokens.push({ text: quoted, kind: colon !== undefined ? "key" : "string" });
      if (colon !== undefined) tokens.push({ text: colon, kind: "punct" });
    } else if (num !== undefined) tokens.push({ text: num, kind: "number" });
    else if (bool !== undefined) tokens.push({ text: bool, kind: "boolean" });
    else if (nul !== undefined) tokens.push({ text: nul, kind: "null" });
    else if (punct !== undefined) tokens.push({ text: punct, kind: "punct" });
    else if (space !== undefined) tokens.push({ text: space, kind: "space" });
    else tokens.push({ text: match[0], kind: "text" });
  }
  return tokens;
}
