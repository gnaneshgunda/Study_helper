import Groq from "groq-sdk";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ── Key rotation ─────────────────────────────────────────────────────────────
// Parse comma-separated keys from env. On each call we cycle to the next key
// so load is spread. On failure the caller tries the next key.

let _keys: string[] = [];
let _keyIdx = 0;
let _clients: Map<string, Groq> = new Map();

function getKeys(): string[] {
  if (_keys.length === 0) {
    const raw = process.env.GROQ_API_KEY ?? "";
    _keys = raw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (_keys.length === 0) throw new Error("GROQ_API_KEY is not set");
  }
  return _keys;
}

function getClient(): { client: Groq; key: string } {
  const keys = getKeys();
  const key = keys[_keyIdx % keys.length];
  _keyIdx++;
  if (!_clients.has(key)) {
    _clients.set(key, new Groq({ apiKey: key }));
  }
  return { client: _clients.get(key)!, key };
}

/** All available keys — used by complete.ts to rotate on failure */
export function getGroqKeyCount(): number {
  return getKeys().length;
}

/** Run with a specific key index (used by complete.ts rotation loop) */
async function withKey<T>(
  keyIdx: number,
  fn: (client: Groq) => Promise<T>
): Promise<T> {
  const keys = getKeys();
  const key = keys[keyIdx % keys.length];
  if (!_clients.has(key)) {
    _clients.set(key, new Groq({ apiKey: key }));
  }
  return fn(_clients.get(key)!);
}

/** Non-streaming completion — tries all keys in sequence on failure */
export async function groqComplete(
  model: string,
  messages: GroqMessage[]
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < getGroqKeyCount(); attempt++) {
    try {
      return await withKey(attempt, async (client) => {
        const res = await client.chat.completions.create({
          model,
          messages,
          temperature: 0.3,
          max_tokens: 2048,
        });
        return res.choices[0]?.message?.content ?? "";
      });
    } catch (err) {
      lastErr = err;
      // Continue to next key on any error (rate limit, auth, server error)
    }
  }
  throw lastErr;
}

/** Streaming completion — tries keys until one works, returns the async iterable */
export async function groqStream(
  model: string,
  messages: GroqMessage[]
): Promise<AsyncIterable<string>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < getGroqKeyCount(); attempt++) {
    try {
      const stream = await withKey(attempt, async (client) => {
        return client.chat.completions.create({
          model,
          messages,
          temperature: 0.3,
          max_tokens: 2048,
          stream: true,
        });
      });

      return (async function* () {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) yield text;
        }
      })();
    } catch (err) {
      lastErr = err;
      // Try next key
    }
  }
  throw lastErr;
}
