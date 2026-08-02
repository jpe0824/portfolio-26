import { describe, expect, it } from "vitest";
import { GENERATION, resolveModels } from "@/lib/ai/provider";

const ids = (env: NodeJS.ProcessEnv) => resolveModels(env).map((candidate) => candidate.id);

describe("resolveModels", () => {
  it("prefers google, then groq, when both keys are present", () => {
    expect(ids({ GOOGLE_GENERATIVE_AI_API_KEY: "g", GROQ_API_KEY: "q" })).toEqual(["google", "groq"]);
  });

  it("returns only groq when the google key is absent", () => {
    expect(ids({ GROQ_API_KEY: "q" })).toEqual(["groq"]);
  });

  it("returns only google when the groq key is absent", () => {
    expect(ids({ GOOGLE_GENERATIVE_AI_API_KEY: "g" })).toEqual(["google"]);
  });

  it("returns an empty chain when no keys are configured", () => {
    // The property that keeps a fresh clone working and CI key-free: no keys is
    // an ordinary state that degrades, not an error that throws.
    expect(resolveModels({})).toEqual([]);
  });

  it("ignores an empty-string key", () => {
    // `vercel env pull` writes empty values for unset variables, so a blank
    // string must not count as configured.
    expect(ids({ GOOGLE_GENERATIVE_AI_API_KEY: "", GROQ_API_KEY: "q" })).toEqual(["groq"]);
  });

  it("does not throw when constructing models", () => {
    expect(() => resolveModels({ GOOGLE_GENERATIVE_AI_API_KEY: "g", GROQ_API_KEY: "q" })).not.toThrow();
  });

  it("caps output at a terminal-sized answer", () => {
    expect(GENERATION.maxOutputTokens).toBeLessThanOrEqual(400);
  });
});
