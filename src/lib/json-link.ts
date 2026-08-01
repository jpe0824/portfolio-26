const URL_PATTERN = /^https?:\/\/\S+$/;

/**
 * Takes a `string`-kind token including its surrounding double quotes, as
 * produced by tokenizeJsonLine. Returns the URL unchanged if the unquoted
 * value is a whole-string http(s) URL, or null otherwise.
 */
export function hrefForJsonString(quoted: string): string | null {
  if (quoted.length < 2 || !quoted.startsWith('"') || !quoted.endsWith('"')) return null;

  const value = quoted.slice(1, -1);

  if (URL_PATTERN.test(value)) return value;
  return null;
}
