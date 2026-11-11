/**
 * Central AI completion function.
 * Picks provider/model per task, retries once on failure,
 * falls back to secondary provider on rate-limit errors.
 */

import { AI_CONFIG, type AiTask } from "./config";
import { hashInput } from "./cache";
import { groqComplete, groqStream, type GroqMessage } from "./providers/groq";
import { geminiComplete, geminiEmbed, type GeminiMessage } from "./providers/gemini";
import { createServiceClient } from "@/lib/supabase/server";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  task: AiTask;
  messages: AiMessage[];
  stream?: boolean;
  json?: boolean;
  /** Skip cache (e.g. for real-time chat) */
  noCache?: boolean;
}

/** Is this a rate-limit error from either provider? */
function isRateLimit(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("rate limit") ||
      msg.includes("429") ||
      msg.includes("quota")
    );
  }
  return false;
}

async function checkCache(
  inputHash: string
): Promise<string | null> {
  try {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from("ai_cache")
      .select("result")
      .eq("input_hash", inputHash)
      .single();
    return data?.result ?? null;
  } catch {
    return null;
  }
}

async function writeCache(
  inputHash: string,
  task: string,
  result: string
): Promise<void> {
  try {
    const supabase = await createServiceClient();
    await supabase
      .from("ai_cache")
      .upsert({ input_hash: inputHash, task, result });
  } catch {
    // Non-fatal — cache write failure should not break the request
  }
}

/** Run a non-streaming completion against a specific provider+model */
async function runComplete(
  provider: "groq" | "gemini",
  model: string,
  messages: AiMessage[]
): Promise<string> {
  if (provider === "groq") {
    // Groq doesn't have a "system" role issue, pass as-is
    return groqComplete(model, messages as GroqMessage[]);
  }
  // Gemini: merge system message into first user message
  const geminiMsgs: GeminiMessage[] = [];
  let systemText = "";
  for (const m of messages) {
    if (m.role === "system") {
      systemText = m.content;
    } else {
      geminiMsgs.push({
        role: m.role,
        content: m.role === "user" && systemText
          ? `${systemText}\n\n${m.content}`
          : m.content,
      });
      systemText = ""; // only prepend to first user turn
    }
  }
  return geminiComplete(model, geminiMsgs);
}

/** Run streaming against a specific provider+model */
async function runStream(
  provider: "groq" | "gemini",
  model: string,
  messages: AiMessage[]
): Promise<AsyncIterable<string>> {
  if (provider === "groq") {
    return groqStream(model, messages as GroqMessage[]);
  }
  // Gemini streaming not implemented — fall back to single response chunked
  const result = await runComplete("gemini", model, messages);
  return (async function* () {
    yield result;
  })();
}

/** Main entry point */
export async function ai(options: CompleteOptions): Promise<string> {
  const { task, messages, noCache } = options;
  const cfg = AI_CONFIG[task];
  const inputHash = hashInput(task, messages);

  // Cache check
  if (!noCache) {
    const cached = await checkCache(inputHash);
    if (cached) return cached;
  }

  let result: string;

  try {
    // First attempt
    result = await runComplete(cfg.provider, cfg.model, messages);
  } catch (err) {
    if (isRateLimit(err) && cfg.fallback) {
      // Fall back on rate limit
      result = await runComplete(cfg.fallback.provider, cfg.fallback.model, messages);
    } else {
      // Retry once on transient error
      try {
        result = await runComplete(cfg.provider, cfg.model, messages);
      } catch (retryErr) {
        if (cfg.fallback) {
          result = await runComplete(cfg.fallback.provider, cfg.fallback.model, messages);
        } else {
          throw retryErr;
        }
      }
    }
  }

  if (!noCache) {
    await writeCache(inputHash, task, result);
  }

  return result;
}

/** Streaming variant — returns an async iterable of text chunks */
export async function aiStream(options: CompleteOptions): Promise<AsyncIterable<string>> {
  const { task, messages } = options;
  const cfg = AI_CONFIG[task];

  try {
    return await runStream(cfg.provider, cfg.model, messages);
  } catch (err) {
    if (isRateLimit(err) && cfg.fallback) {
      return runStream(cfg.fallback.provider, cfg.fallback.model, messages);
    }
    throw err;
  }
}

/** Embed text — always uses Gemini embed model */
export async function aiEmbed(text: string): Promise<number[]> {
  const cfg = AI_CONFIG["embed"];
  return geminiEmbed(cfg.model, text);
}
