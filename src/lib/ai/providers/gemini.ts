import {
  GoogleGenerativeAI,
  type Content,
  type Part,
} from "@google/generative-ai";

export interface GeminiMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Key rotation (same pattern as Groq) ─────────────────────────────────────

let _keys: string[] = [];
let _clients: Map<string, GoogleGenerativeAI> = new Map();

function getKeys(): string[] {
  if (_keys.length === 0) {
    const raw = process.env.GEMINI_API_KEY ?? "";
    _keys = raw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (_keys.length === 0) throw new Error("GEMINI_API_KEY is not set");
  }
  return _keys;
}

export function getGeminiKeyCount(): number {
  return getKeys().length;
}

function getClient(keyIdx: number): GoogleGenerativeAI {
  const keys = getKeys();
  const key = keys[keyIdx % keys.length];
  if (!_clients.has(key)) {
    _clients.set(key, new GoogleGenerativeAI(key));
  }
  return _clients.get(key)!;
}

function toGeminiContents(messages: GeminiMessage[]): Content[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }] as Part[],
  }));
}

/** Non-streaming completion — tries all keys in sequence on failure */
export async function geminiComplete(
  model: string,
  messages: GeminiMessage[]
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < getGeminiKeyCount(); attempt++) {
    try {
      const genai = getClient(attempt);
      const genModel = genai.getGenerativeModel({ model });
      const result = await genModel.generateContent({
        contents: toGeminiContents(messages),
      });
      return result.response.text();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/** Embed text — tries all keys in sequence */
export async function geminiEmbed(
  model: string,
  text: string
): Promise<number[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < getGeminiKeyCount(); attempt++) {
    try {
      const genai = getClient(attempt);
      const embedModel = genai.getGenerativeModel({ model });
      const result = await embedModel.embedContent(text);
      return result.embedding.values;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}
