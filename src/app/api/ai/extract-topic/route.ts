import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ai } from "@/lib/ai/complete";
import { TOPIC_EXTRACT_SYSTEM } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { content } = await request.json() as { content: string };
    if (!content?.trim()) return NextResponse.json({ error: "No content" }, { status: 400 });

    const topic = await ai({
      task: "format",
      messages: [
        { role: "system", content: TOPIC_EXTRACT_SYSTEM },
        { role: "user", content: content.slice(0, 1000) },
      ],
    });

    return NextResponse.json({ topic: topic.trim().replace(/"/g, "") });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
