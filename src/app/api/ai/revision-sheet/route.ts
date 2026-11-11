import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ai } from "@/lib/ai/complete";
import { revisionSheetPrompt } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { courseId } = await request.json() as { courseId: string };
    if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

    const svc = await createServiceClient();

    // Fetch course info, notes, and unresolved doubts
    const [courseRes, notesRes, doubtsRes] = await Promise.all([
      svc.from("courses").select("name").eq("id", courseId).single(),
      svc.from("notes").select("content_md, page_number").eq("course_id", courseId).order("page_number"),
      svc.from("doubts").select("title").eq("status", "open")
        .in("document_id",
          (await svc.from("documents")
            .select("id")
            .in("lecture_id",
              (await svc.from("lectures").select("id").eq("course_id", courseId)).data?.map(l => l.id) ?? []
            )
          ).data?.map(d => d.id) ?? []
        ),
    ]);

    const courseName = courseRes.data?.name ?? "Unknown course";
    const notes = notesRes.data ?? [];
    const unresolvedDoubts = doubtsRes.data ?? [];

    const material = [
      "## Notes\n",
      notes.map((n) => n.content_md).join("\n\n---\n\n"),
      "\n\n## Unresolved Doubts\n",
      unresolvedDoubts.map((d) => `- ${d.title}`).join("\n"),
    ].join("\n");

    const sheet = await ai({
      task: "chat",
      messages: [
        { role: "system", content: revisionSheetPrompt(courseName) },
        { role: "user", content: material },
      ],
      noCache: false,
    });

    return NextResponse.json({ sheet, courseName });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
