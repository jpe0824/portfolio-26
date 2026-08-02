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
const NAME = /\bJason(?:\s+Edman)?(?:['']s)?\b/gi;

/** Longest real match, `Jason Edman's`. Nothing beyond this can be a partial match. */
const LONGEST = "Jason Edman's".length;

/**
 * How far back the streaming filter inspects for a partial match. Larger than LONGEST so that
 * a name separated by more whitespace than usual (`Jason   Edman`) is still caught mid-stream.
 * A gap wider than this would be emitted unredacted, which no model produces in practice.
 */
const WINDOW = 32;

/** Tails that could still grow into a match once more text arrives. */
const PARTIAL = /^jason\s*(?:e|ed|edm|edma|edman)?['']?s?$/i;

function pronounFor(match: string, ...rest: any[]): string {
  const offset = rest[rest.length - 2];
  const string = rest[rest.length - 1];

  const possessive = /['']s$/.test(match);

  // Capitalize if at the start of string or after a sentence boundary (skipping spaces).
  let capitalized = offset === 0;
  if (!capitalized && offset > 0) {
    let checkPos = offset - 1;
    // Skip back over spaces, but not newlines (newlines are boundaries themselves).
    while (checkPos >= 0 && string[checkPos] === " ") {
      checkPos--;
    }
    if (checkPos >= 0) {
      capitalized = string[checkPos] === "." || string[checkPos] === "\n";
    } else {
      capitalized = true; // Only spaces before this.
    }
  }

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

  /** Index at which it is safe to cut: no completed match straddles it, none could start after. */
  function safeCut(): number {
    const reach = Math.min(buffer.length, WINDOW);
    for (let back = reach; back >= 1; back--) {
      const tail = buffer.slice(buffer.length - back);
      if ("jason".startsWith(tail.toLowerCase()) || PARTIAL.test(tail)) {
        return buffer.length - back;
      }
    }
    return buffer.length;
  }

  function redactWithContext(text: string): string {
    return text.replace(NAME, (match: string, ...rest: any[]) => {
      const offset = rest[rest.length - 2];
      const string = rest[rest.length - 1];

      const possessive = /['']s$/.test(match);

      let capitalized;
      if (offset === 0) {
        // At the start of this chunk; use what we've seen before.
        capitalized = lastChar === "" || lastChar === "." || lastChar === "\n";
      } else {
        // Within this chunk; skip back over spaces to find a sentence boundary.
        let checkPos = offset - 1;
        while (checkPos >= 0 && string[checkPos] === " ") {
          checkPos--;
        }
        if (checkPos >= 0) {
          capitalized = string[checkPos] === "." || string[checkPos] === "\n";
        } else {
          // Only spaces before this; check what came before the chunk.
          capitalized = lastChar === "" || lastChar === "." || lastChar === "\n";
        }
      }

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
