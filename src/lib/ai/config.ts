export type AiTask = "chat" | "format" | "vision" | "embed";

export interface ProviderConfig {
  provider: "groq" | "gemini";
  model: string;
  fallback?: {
    provider: "groq" | "gemini";
    model: string;
  };
}

export const AI_CONFIG: Record<AiTask, ProviderConfig> = {
  chat: {
    provider: "groq",
    model: "openai/gpt-oss-120b",          // free tier, 131k context
    fallback: { provider: "gemini", model: "gemini-3.8-flash" },
  },
  format: {
    provider: "groq",
    model: "openai/gpt-oss-20b",           // free tier, faster + cheaper
    fallback: { provider: "gemini", model: "gemini-3.8-flash" },
  },
  vision: {
    provider: "gemini",
    model: "gemini-3.8-flash",
  },
  embed: {
    provider: "gemini",
    model: "text-embedding-004",
  },
};
