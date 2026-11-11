import Groq from "groq-sdk";

let _groq: Groq | null = null;

function getGroq(): Groq {
  if (!_groq) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not set");
    }
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Non-streaming completion */
export async function groqComplete(
  model: string,
  messages: GroqMessage[]
): Promise<string> {
  const groq = getGroq();
  const res = await groq.chat.completions.create({
    model,
    messages,
    temperature: 0.3,
    max_tokens: 2048,
  });
  return res.choices[0]?.message?.content ?? "";
}

/** Streaming completion — returns an async iterable of text chunks */
export async function groqStream(
  model: string,
  messages: GroqMessage[]
): Promise<AsyncIterable<string>> {
  const groq = getGroq();
  const stream = await groq.chat.completions.create({
    model,
    messages,
    temperature: 0.3,
    max_tokens: 2048,
    stream: true,
  });

  return (async function* () {
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) yield text;
    }
  })();
}
