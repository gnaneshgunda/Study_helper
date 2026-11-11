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
    model: "llama-3.3-70b-versatile",
    fallback: { provider: "gemini", model: "gemini-3.8-flash" },
  },
  format: {
    provider: "groq",
    model: "llama-3.1-8b-instant",
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
