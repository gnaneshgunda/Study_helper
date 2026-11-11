import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ai } from "@/lib/ai/complete";
import { flashcardsPrompt } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { courseId, noteIds, n = 10 } = await request.json() as {
      courseId: string;
      noteIds?: string[];
      n?: number;
    };

    if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

    const svc = await createServiceClient();

    let query = svc.from("notes").select("content_md").eq("course_id", courseId);
    if (noteIds?.length) query = query.in("id", noteIds);

    const { data: notes } = await query;
    if (!notes?.length) return NextResponse.json({ error: "No notes found" }, { status: 400 });

    const noteText = notes.map((n) => n.content_md).join("\n\n---\n\n");

    const raw = await ai({
      task: "format",
      messages: [
        { role: "system", content: flashcardsPrompt(n) },
        { role: "user", content: noteText },
      ],
      json: true,
    });

    // Extract JSON from the response (model may wrap it in markdown)
    const match = raw.match(/\[[\s\S]*\]/);
    const cards = match ? JSON.parse(match[0]) : [];

    // Persist flashcards
    if (cards.length > 0) {
      await svc.from("flashcards").insert(
        cards.map((c: { front: string; back: string }) => ({
          course_id: courseId,
          front: c.front,
          back: c.back,
        }))
      );
    }

    return NextResponse.json({ flashcards: cards });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
