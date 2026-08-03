import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

/**
 * The entire provider seam. Phase 3 ("local LLM on Proxmox") edits this file and nothing else:
 * it prepends a candidate pointing at an OpenAI-compatible endpoint on the homelab host and
 * leaves the hosted chain intact beneath it as fallback. No route change, no UI change.
 *
 * Both providers are free tiers with no card on file, which is what makes the cost ceiling
 * structural: exhaustion returns 429, and a 429 cannot become a bill.
 */

// Pinned against live provider docs, not from memory: free-tier lineups and rate limits shift
// over months, and providers announce shutdown dates for specific model ids with only weeks of
// notice. Both are single constants precisely so re-pinning stays a one-line change.
const GOOGLE_MODEL = "gemini-3.5-flash-lite";
const GROQ_MODEL = "openai/gpt-oss-20b";

/** Terminal-sized answers, and a low temperature because this is grounded extraction. */
export const GENERATION = { maxOutputTokens: 400, temperature: 0.3 };

export type Candidate = { id: "google" | "groq"; model: LanguageModel };

/**
 * Ordered fallback chain, built from whichever keys are present. An empty array is an ordinary
 * result, not an error: the route turns it into a "not configured" line so the build succeeds
 * and the suite passes green with zero secrets.
 */
// `NodeJS.ProcessEnv` (via Next.js's global augmentation) requires `NODE_ENV`, which this
// function never reads. A structural type of exactly what's used keeps `process.env` a valid
// default while letting callers (tests included) pass a bare two-key object.
export function resolveModels(env: Record<string, string | undefined> = process.env): Candidate[] {
  const candidates: Candidate[] = [];

  const googleKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (googleKey) {
    candidates.push({ id: "google", model: createGoogleGenerativeAI({ apiKey: googleKey })(GOOGLE_MODEL) });
  }

  const groqKey = env.GROQ_API_KEY;
  if (groqKey) {
    candidates.push({ id: "groq", model: createGroq({ apiKey: groqKey })(GROQ_MODEL) });
  }

  return candidates;
}
