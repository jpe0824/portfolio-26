import { streamText } from "ai";
import { manifest } from "@/content/manifest";
import { readContentFile } from "@/lib/read-content";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { GENERATION, resolveModels, type Candidate } from "@/lib/ai/provider";
import { createRedactor } from "@/lib/ai/redact";

/**
 * The site's only dynamic route; every page stays statically prerendered.
 *
 * Node, not edge: streaming needs no edge runtime on Vercel, and Node keeps `readContentFile`
 * available for prompt assembly.
 */
export const runtime = "nodejs";

export const MAX_QUESTION_CHARS = 500;
export const MAX_MESSAGES = 6;

type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Built once per cold start rather than per request. The corpus is read from disk and never
 * changes within a deployment, so re-reading it on every request would be pure waste.
 */
let promptPromise: Promise<string> | null = null;
function systemPrompt(): Promise<string> {
  promptPromise ??= buildSystemPrompt(manifest, readContentFile).catch((error: unknown) => {
    promptPromise = null;
    throw error;
  });
  return promptPromise;
}

/**
 * Per-instance, not global. Fluid Compute reuses instances so this catches a naive flood, but
 * it resets on cold start and does not coordinate across instances. It is a speed bump; the
 * provider's own free-tier quota is the actual ceiling, and that ceiling cannot bill.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

function text(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

/**
 * `Origin` is browser-controlled but not guaranteed to be a well-formed absolute URL:
 * sandboxed iframes, `data:` URLs, and some cross-origin redirects send the literal string
 * "null". `new URL` throws on that, and failing open here (letting an unparseable value
 * through) would defeat the point of the check, so an unparseable origin counts as cross-origin.
 */
function isCrossOrigin(origin: string, requestUrl: string): boolean {
  try {
    return new URL(origin).host !== new URL(requestUrl).host;
  } catch {
    return true;
  }
}

function parse(body: unknown): ChatMessage[] | null {
  if (typeof body !== "object" || body === null) return null;
  const { messages } = body as { messages?: unknown };
  if (!Array.isArray(messages) || messages.length === 0) return null;

  const parsed: ChatMessage[] = [];
  for (const message of messages) {
    if (typeof message !== "object" || message === null) return null;
    const { role, content } = message as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    parsed.push({ role, content });
  }

  // Only the newest message is length-checked. GENERATION.maxOutputTokens allows assistant
  // replies well past 500 characters, and old user turns were already validated when they
  // were first sent — capping every message here would make a second question in the same
  // conversation 400 as soon as any prior answer ran long.
  if (parsed[parsed.length - 1].content.length > MAX_QUESTION_CHARS) return null;

  // Truncation rather than rejection: a long conversation is legitimate, it just does not all
  // need to be sent. slice(-N) keeps the most recent turn, which is the actual question.
  return parsed.slice(-MAX_MESSAGES);
}

/** Returns the first candidate that yields a chunk, so a provider that 429s is skipped silently. */
async function openStream(candidates: Candidate[], system: string, messages: ChatMessage[]) {
  for (const candidate of candidates) {
    try {
      const result = streamText({ model: candidate.model, system, messages, ...GENERATION });
      const iterator = result.textStream[Symbol.asyncIterator]();
      const first = await iterator.next();
      return { iterator, first };
    } catch {
      // Try the next provider. A failure here is a quota or availability problem, and the
      // visitor should never learn which provider was tried.
    }
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  // Same-origin only. Cheap deterrent against casual direct use of the endpoint; not a security
  // boundary, since Origin is trivially forged outside a browser.
  const origin = request.headers.get("origin");
  if (origin && isCrossOrigin(origin, request.url)) {
    return text("cross-origin requests are not accepted", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return text("malformed body", 400);
  }

  const messages = parse(body);
  if (!messages) return text("malformed body", 400);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) return text("slow down", 429);

  // Resolved once and threaded through: calling resolveModels() again inside openStream would
  // construct a second set of model objects for no reason.
  const candidates = resolveModels();
  if (candidates.length === 0) return text("no model configured", 503);

  const opened = await openStream(candidates, await systemPrompt(), messages);
  if (!opened) return text("no provider available", 502);

  const { iterator, first } = opened;
  const redactor = createRedactor();

  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const emit = (value: string) => {
          if (value) controller.enqueue(encoder.encode(value));
        };

        try {
          // `first` was already pulled to prove the provider is live; replay it here.
          if (!first.done && first.value) emit(redactor.push(first.value));
          if (!first.done) {
            for (let next = await iterator.next(); !next.done; next = await iterator.next()) {
              emit(redactor.push(next.value));
            }
          }
          emit(redactor.flush());
        } catch {
          // A mid-stream failure truncates the answer rather than retrying: the visitor has
          // already seen partial text, and restarting on another provider would rewrite it.
          emit(redactor.flush());
        } finally {
          controller.close();
        }
      },
    }),
    { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}
