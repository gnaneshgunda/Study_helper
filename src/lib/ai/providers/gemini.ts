import {
  GoogleGenerativeAI,
  type Content,
  type Part,
} from "@google/generative-ai";

let _genai: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    _genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _genai;
}

export interface GeminiMessage {
  role: "user" | "assistant";
  content: string;
}

function toGeminiContents(messages: GeminiMessage[]): Content[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }] as Part[],
  }));
}

export async function geminiComplete(
  model: string,
  messages: GeminiMessage[]
): Promise<string> {
  const genai = getGenAI();
  const genModel = genai.getGenerativeModel({ model });
  const contents = toGeminiContents(messages);
  const result = await genModel.generateContent({ contents });
  return result.response.text();
}

export async function geminiEmbed(
  model: string,
  text: string
): Promise<number[]> {
  const genai = getGenAI();
  const embedModel = genai.getGenerativeModel({ model });
  const result = await embedModel.embedContent(text);
  return result.embedding.values;
}
