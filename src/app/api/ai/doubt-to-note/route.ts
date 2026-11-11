import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ai } from "@/lib/ai/complete";
import { DOUBT_TO_NOTE_SYSTEM } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { doubtId } = await request.json() as { doubtId: string };
    if (!doubtId) {
      return NextResponse.json({ error: "doubtId required" }, { status: 400 });
    }

    const svc = await createServiceClient();

    // Fetch thread messages
    const { data: messages } = await svc
      .from("messages")
      .select("role, content")
      .eq("doubt_id", doubtId)
      .order("created_at", { ascending: true });

    if (!messages?.length) {
      return NextResponse.json({ error: "No messages in this doubt" }, { status: 400 });
    }

    // Format conversation for the prompt
    const conversation = messages
      .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
      .join("\n\n");

    const note = await ai({
      task: "format",
      messages: [
        { role: "system", content: DOUBT_TO_NOTE_SYSTEM },
        { role: "user", content: conversation },
      ],
      noCache: false,
    });

    return NextResponse.json({ note });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
