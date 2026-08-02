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
 * case is needed anywhere in this file.
 */

/**
 * ASCII U+0027 and typographic U+2019. Written as escapes, never as literal glyphs:
 * the two are visually near-identical, and a mistyped class silently stops matching
 * the form models actually emit.
 */
const APOSTROPHE = "[\\u0027\\u2019]";

const NAME = new RegExp(`\\bJason(?:\\s+Edman)?(?:${APOSTROPHE}s)?\\b`, "gi");

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

function pronounFor(match: string, offset: number, string: string): string {
  const possessiveRegex = new RegExp(`${APOSTROPHE}s$`);
  const possessive = possessiveRegex.test(match);
  const capitalized = shouldCapitalize(offset, string, null);

  if (possessive) return capitalized ? "His" : "his";
  return capitalized ? "He" : "he";
}

/** Replaces every occurrence in a complete string. Use on text that will not grow. */
export function redactText(text: string): string {
  return text.replace(NAME, pronounFor);
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
   * Also check for a bare prefix of "jason" at the very end (up to PREFIX_WINDOW length).
   */
  function safeCut(): number {
    const lowerBuffer = buffer.toLowerCase();

    // Look for the last occurrence of "jason".
    const lastJasonIndex = lowerBuffer.lastIndexOf("jason");
    if (lastJasonIndex !== -1) {
      // Everything after "jason" (5 chars).
      const afterJason = buffer.slice(lastJasonIndex + 5);
      // Check if it’s all whitespace + optional partial edman + optional possessive.
      // PARTIAL tests "jason" at the start, but we need to test what comes after.
      // Strip the leading "jason" and test the tail: space + optional edman + optional possessive.
      const tailRegex = new RegExp(`^\\s*(?:e|ed|edm|edma|edman)?${APOSTROPHE}?s?$`, "i");
      if (tailRegex.test(afterJason)) {
        // Safe to cut before "jason".
        return lastJasonIndex;
      }
    }

    // Also check for a bare prefix of "jason" at the very end of the buffer.
    const reach = Math.min(buffer.length, PREFIX_WINDOW);
    for (let back = reach; back >= 1; back--) {
      const tail = buffer.slice(buffer.length - back);
      if ("jason".startsWith(tail.toLowerCase())) {
        // Could still be growing into "jason".
        return buffer.length - back;
      }
    }

    // Nothing could grow into a match.
    return buffer.length;
  }

  function redactWithContext(text: string): string {
    const possessiveRegex = new RegExp(`${APOSTROPHE}s$`);
    return text.replace(NAME, (match: string, offset: number, string: string) => {
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
