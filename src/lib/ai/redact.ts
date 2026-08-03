/**
 * The site never names its subject in model output — the reader is already on his site.
 *
 * A system-prompt rule alone is not sufficient: `src/content/files/whoami.md` opens with the
 * exact string the model is told not to emit, so the model is handed its own temptation as
 * context. This module is the guarantee; the prompt rule is only the first layer.
 */

/**
 * Word boundaries are load-bearing rather than incidental: they are the entire reason a URL
 * such as `linkedin.com/in/jasonedman/` survives untouched. There is no boundary between
 * `jason` and `edman` inside that slug, so the pattern cannot match it, and no URL special
 * case is needed anywhere in this file. The same reasoning protects the site's own domain,
 * `jsonedman.dev`: it contains the literal substring "edman", but nothing but a word character
 * (`n`, from "json") precedes it, so the bare-surname alternative below cannot start there either.
 */

/**
 * ASCII U+0027 and typographic U+2019. Written as escapes, never as literal glyphs:
 * the two are visually near-identical, and a mistyped class silently stops matching
 * the form models actually emit.
 */
const APOSTROPHE = "[\\u0027\\u2019]";

// The bare surname is its own alternative, not folded into `Jason(?:\s+Edman)?` optionality:
// a model shortening to the surname on second reference ("Edman built the edge stack") is
// ordinary usage, not an exotic case, and the full name's own optional-Edman branch only ever
// fires when "Jason" precedes it.
const NAME = new RegExp(`\\b(?:Jason(?:\\s+Edman)?|Edman)(?:${APOSTROPHE}s)?\\b`, "gi");

/**
 * How far back to look for a bare prefix of "jason" at the very end of the buffer.
 * Longer than the bare prefix would naturally grow, but short enough to avoid false positives.
 */
const PREFIX_WINDOW = 5;

/**
 * Determine if a match should be capitalized based on what precedes it.
 * Precedence is a sentence boundary (. or \n), skipping spaces; otherwise, use the given fallback.
 */
function shouldCapitalize(offset: number, string: string, precedingChar: string | null): boolean {
  if (offset === 0) {
    // At the start of the string being redacted; use the fallback (last emitted char or start-of-all).
    return precedingChar === "" || precedingChar === "." || precedingChar === "\n" || precedingChar === null;
  }

  // Within the string; skip back over spaces to find a sentence boundary.
  let checkPos = offset - 1;
  while (checkPos >= 0 && string[checkPos] === " ") {
    checkPos--;
  }
  if (checkPos >= 0) {
    return string[checkPos] === "." || string[checkPos] === "\n";
  }

  // Only spaces before this; use the fallback.
  return precedingChar === "" || precedingChar === "." || precedingChar === "\n" || precedingChar === null;
}

/**
 * Replaces every occurrence in a complete string. Use on text that will not grow.
 *
 * Delegates to `createRedactor` rather than keeping a second, parallel implementation: a
 * complete string is just the one-chunk case of the streaming path (push it, then flush), so
 * this is that path exercised once instead of a second regex-replace that could drift from it.
 */
export function redactText(text: string): string {
  const redactor = createRedactor();
  return redactor.push(text) + redactor.flush();
}

/**
 * A token stream splits words at arbitrary offsets, so `"Jas"` followed by `"on Edman"` would
 * sail straight through a per-chunk `redactText`. This holds back any trailing run that could
 * still become a match and releases it once the next chunk proves it cannot.
 */
export function createRedactor(): { push(chunk: string): string; flush(): string } {
  let buffer = "";
  let lastChar = "";

  /**
   * Index at which it is safe to cut: no completed match straddles it, none could start after.
   * Strategy: look for the last occurrence of "jason" in the buffer. If found, check that
   * everything after it is whitespace + optional partial "edman" + optional possessive.
   * Separately, do the same for the last occurrence of a standalone "edman" — a bare surname
   * arriving split across chunks (e.g. `"Ed"` then `"man"`) needs its own guard, since it does
   * not begin with "jason" and so the check above never sees it. Where both fire, the earlier
   * of the two wins: everything from that point on is what might still be growing.
   * Also check for a bare prefix of "jason" or "edman" at the very end (up to PREFIX_WINDOW
   * length), for the case where not even the first full keyword has arrived yet.
   */
  function safeCut(): number {
    const lowerBuffer = buffer.toLowerCase();
    const pendingCuts: number[] = [];

    // Look for the last occurrence of "jason".
    const lastJasonIndex = lowerBuffer.lastIndexOf("jason");
    if (lastJasonIndex !== -1) {
      // Everything after "jason" (5 chars).
      const afterJason = buffer.slice(lastJasonIndex + 5);
      // Check if it’s all whitespace + optional partial edman + optional possessive.
      // PARTIAL tests "jason" at the start, but we need to test what comes after.
      // Strip the leading "jason" and test the tail: space + optional edman + optional possessive.
      const growingTail = new RegExp(`^\\s*(?:e|ed|edm|edma|edman)?${APOSTROPHE}?s?$`, "i");
      if (growingTail.test(afterJason)) {
        // Safe to cut before "jason".
        pendingCuts.push(lastJasonIndex);
      }
    }

    // Look for the last occurrence of a standalone "edman", mirroring the check above: nothing
    // after it but an optional, possibly-partial possessive suffix.
    const lastEdmanIndex = lowerBuffer.lastIndexOf("edman");
    if (lastEdmanIndex !== -1) {
      const afterEdman = buffer.slice(lastEdmanIndex + 5);
      const growingTail = new RegExp(`^${APOSTROPHE}?s?$`, "i");
      if (growingTail.test(afterEdman)) {
        pendingCuts.push(lastEdmanIndex);
      }
    }

    if (pendingCuts.length > 0) return Math.min(...pendingCuts);

    // Also check for a bare prefix of "jason" or "edman" at the very end of the buffer.
    const reach = Math.min(buffer.length, PREFIX_WINDOW);
    for (let back = reach; back >= 1; back--) {
      const tail = buffer.slice(buffer.length - back).toLowerCase();
      if ("jason".startsWith(tail) || "edman".startsWith(tail)) {
        // Could still be growing into "jason" or "edman".
        return buffer.length - back;
      }
    }

    // Nothing could grow into a match.
    return buffer.length;
  }

  function redactWithContext(text: string): string {
    const possessiveRegex = new RegExp(`${APOSTROPHE}s$`);
    return text.replace(NAME, (match: string, offset: number, string: string) => {
      // `\b` at offset 0 of `text` succeeds whenever the match's first character is a word
      // character — regardless of what actually preceded `text` in the original stream, which
      // this isolated call cannot see. `lastChar` is that missing context (the real previous
      // character, carried over from an earlier push): if it is itself a word character, no
      // boundary really exists here and the match must be left alone. This is what keeps a
      // chunk boundary that happens to land right after "json" — stranding "edman.dev" as its
      // own fragment — from misreading a piece of `jsonedman.dev` as the bare surname.
      if (offset === 0 && /\w/.test(lastChar)) return match;

      const possessive = possessiveRegex.test(match);
      const capitalized = shouldCapitalize(offset, string, lastChar || null);

      if (possessive) return capitalized ? "His" : "his";
      return capitalized ? "He" : "he";
    });
  }

  return {
    push(chunk) {
      buffer += chunk;
      const cut = safeCut();
      if (cut === 0) return "";
      const ready = buffer.slice(0, cut);
      buffer = buffer.slice(cut);
      const result = redactWithContext(ready);
      if (result.length > 0) {
        lastChar = result[result.length - 1];
      }
      return result;
    },
    flush() {
      const rest = redactWithContext(buffer);
      buffer = "";
      return rest;
    },
  };
}
