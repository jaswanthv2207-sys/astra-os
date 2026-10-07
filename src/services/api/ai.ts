import type { AiProvider } from "@/stores";

/**
 * AI transport — direct browser → provider calls.
 *
 * Streams server-sent events from OpenAI's chat completions endpoint or
 * Anthropic's messages endpoint, normalised into one async generator the
 * assistant panel consumes token by token. The key comes from the device
 * settings store and is never sent anywhere but the provider itself.
 *
 * Everything here is opt-in: no key ⇒ callers never reach this file and
 * the built-in deterministic engine answers every ask.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiRequest {
  provider: AiProvider;
  /** Resolved model id (blank fields are resolved by the caller). */
  model: string;
  key: string;
  messages: ChatMessage[];
  /** Hard cap — keeps free-form answers conversation-sized. */
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface AiResult {
  ok: boolean;
  message: string;
}

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 45_000;

/** Pull a readable message out of a provider error body. */
async function providerError(response: Response): Promise<Error> {
  let detail = `${response.status} ${response.statusText}`;
  try {
    const body = (await response.json()) as {
      error?: { message?: string } | string;
      message?: string;
    };
    const message =
      typeof body.error === "string"
        ? body.error
        : (body.error?.message ?? body.message);
    if (message) detail = message;
  } catch {
    /* non-JSON error body — keep the status line */
  }
  return new Error(detail);
}

/* ── Request shaping ─────────────────────────────────────────────────────── */

function buildRequest(request: AiRequest, stream: boolean): RequestInit {
  const { provider, model, key, messages, maxTokens } = request;

  if (provider === "anthropic") {
    // Anthropic keeps the system prompt as a top-level field.
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const rest = messages.filter((m) => m.role !== "system");
    return {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        /* Required for direct browser calls — Anthropic's CORS opt-in. */
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens ?? (stream ? 1024 : 16),
        ...(system ? { system } : {}),
        messages: rest.map((m) => ({ role: m.role, content: m.content })),
        ...(stream ? { stream: true } : {}),
      }),
    };
  }

  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      ...(stream ? { stream: true } : {}),
    }),
  };
}

const urlFor = (provider: AiProvider) =>
  provider === "anthropic" ? ANTHROPIC_URL : OPENAI_URL;

/* ── SSE plumbing ────────────────────────────────────────────────────────── */

/** Parse one `data:` payload; malformed frames are skipped, not fatal. */
function parseJson(data: string): unknown | null {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}

/** Extract a text delta from one provider's `data:` payload. */
function deltaParser(provider: AiProvider) {
  if (provider === "anthropic") {
    return (data: string): string | null => {
      if (data === "[DONE]") return null;
      const event = parseJson(data) as {
        type?: string;
        delta?: { text?: string };
        error?: { message?: string };
      } | null;
      if (!event) return null;
      if (event.type === "content_block_delta") return event.delta?.text ?? "";
      if (event.type === "error") {
        throw new Error(event.error?.message ?? "Provider error");
      }
      return null; // message_start / ping / message_stop
    };
  }
  return (data: string): string | null => {
    if (data === "[DONE]") return null;
    const event = parseJson(data) as {
      choices?: Array<{ delta?: { content?: string } }>;
      error?: { message?: string };
    } | null;
    if (!event) return null;
    if (event.error?.message) throw new Error(event.error.message);
    return event.choices?.[0]?.delta?.content ?? "";
  };
}

async function* readSse(
  body: ReadableStream<Uint8Array>,
  extract: (data: string) => string | null,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      for (const line of event.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const chunk = extract(line.slice(5).trim());
        if (chunk) yield chunk;
      }
    }
  }
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/**
 * Stream a completion. Yields text deltas as they arrive.
 *
 * @example
 * for await (const chunk of streamChat(req)) text += chunk;
 */
export async function* streamChat(request: AiRequest): AsyncGenerator<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  request.signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetch(urlFor(request.provider), {
      ...buildRequest(request, true),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw await providerError(response);
    yield* readSse(response.body, deltaParser(request.provider));
  } finally {
    window.clearTimeout(timeout);
    request.signal?.removeEventListener("abort", onAbort);
  }
}

/** Cheap liveness probe — one tiny completion, no streaming. */
export async function testAiConnection(
  request: Omit<AiRequest, "signal">,
): Promise<AiResult> {
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(urlFor(request.provider), {
        ...buildRequest(request, false),
        signal: controller.signal,
      });
      if (!response.ok) throw await providerError(response);
      return {
        ok: true,
        message: `Connected — ${request.model} answered.`,
      };
    } finally {
      window.clearTimeout(timeout);
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Connection failed.",
    };
  }
}
