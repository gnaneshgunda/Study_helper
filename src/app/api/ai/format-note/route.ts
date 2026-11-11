import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ai } from "@/lib/ai/complete";
import { FORMAT_NOTE_SYSTEM } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { content } = await request.json() as { content: string };
    if (!content?.trim()) {
      return NextResponse.json({ error: "No content provided" }, { status: 400 });
    }

    const formatted = await ai({
      task: "format",
      messages: [
        { role: "system", content: FORMAT_NOTE_SYSTEM },
        { role: "user", content: content.trim() },
      ],
      noCache: false,
    });

    return NextResponse.json({ formatted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
