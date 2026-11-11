import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { aiStream, aiEmbed, ai } from "@/lib/ai/complete";
import { doubtTutorSystem, revisionSheetPrompt } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequest {
  doubtId: string;
  documentId: string;
  pageNumber: number;
  courseName: string;
  lectureTitle: string;
  userMessage: string;
  doubtTitle?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body: ChatRequest = await request.json();
    const { doubtId, documentId, pageNumber, courseName, lectureTitle, userMessage, doubtTitle } = body;

    if (!documentId || !pageNumber || !userMessage?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const svc = await createServiceClient();

    // ── 1. Resolve courseId (needed later for revision note) ─────────────────
    const { data: docRow } = await svc
      .from("documents")
      .select("lecture_id, lectures(course_id)")
      .eq("id", documentId)
      .single();
    const courseId = (docRow?.lectures as unknown as { course_id: string } | null)?.course_id ?? "";

    // ── 2. Resolve or create the doubt ──────────────────────────────────────
    let resolvedDoubtId = doubtId;
    if (!resolvedDoubtId) {
      const { data: newDoubt, error: doubtErr } = await svc
        .from("doubts")
        .insert({
          document_id: documentId,
          page_number: pageNumber,
          title: doubtTitle?.trim() || userMessage.trim().slice(0, 100),
          status: "open",
        })
        .select("id")
        .single();

      if (doubtErr || !newDoubt) {
        return NextResponse.json({ error: "Could not create doubt" }, { status: 500 });
      }
      resolvedDoubtId = newDoubt.id;
    }

    // ── 3. Persist user message ──────────────────────────────────────────────
    await svc.from("messages").insert({
      doubt_id: resolvedDoubtId,
      role: "user",
      content: userMessage.trim(),
    });

    // ── 4. Build slide context via RAG ───────────────────────────────────────
    const { data: currentPageRow } = await svc
      .from("pages")
      .select("text")
      .eq("document_id", documentId)
      .eq("page_number", pageNumber)
      .single();

    const currentText = currentPageRow?.text ?? "(no text extracted)";
    let ragContext = "";

    try {
      const queryEmbedding = await aiEmbed(userMessage.trim());
      const { data: similarPages } = await svc.rpc("match_pages", {
        query_embedding: queryEmbedding,
        document_id_filter: documentId,
        match_count: 4,
      });

      if (similarPages && similarPages.length > 0) {
        const relevant = (similarPages as { page_number: number; text: string; similarity: number }[])
          .filter((p) => p.page_number !== pageNumber && p.similarity > 0.5)
          .slice(0, 3);

        if (relevant.length > 0) {
          ragContext = "\n\nRelated slides:\n" +
            relevant.map((p) => `[Slide ${p.page_number}]: ${p.text}`).join("\n\n");
        }
      }
    } catch {
      // Fall back to neighbouring pages if embeddings unavailable
      const { data: neighbours } = await svc
        .from("pages")
        .select("page_number, text")
        .eq("document_id", documentId)
        .in("page_number", [pageNumber - 1, pageNumber + 1]);

      const nMap = Object.fromEntries((neighbours ?? []).map((p) => [p.page_number, p.text]));
      const prevText = nMap[pageNumber - 1];
      const nextText = nMap[pageNumber + 1];
      if (prevText) ragContext += `\n\nPrevious slide: ${prevText}`;
      if (nextText) ragContext += `\n\nNext slide: ${nextText}`;
    }

    // ── 5. Fetch prior messages ──────────────────────────────────────────────
    const { data: history } = await svc
      .from("messages")
      .select("role, content")
      .eq("doubt_id", resolvedDoubtId)
      .order("created_at", { ascending: true })
      .limit(20);

    const priorMessages = (history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // ── 6. Build prompt ──────────────────────────────────────────────────────
    const systemPrompt = doubtTutorSystem({
      course_name: courseName,
      page: pageNumber,
      lecture_title: lectureTitle,
      slide_text: currentText + ragContext,
      prev_slide_text: "",
      next_slide_text: "",
    });

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...priorMessages,
    ];

    // ── 7. Stream response ───────────────────────────────────────────────────
    const stream = await aiStream({ task: "chat", messages, noCache: true });
    const encoder = new TextEncoder();
    let fullResponse = "";
    const uid = user.id;

    const readable = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ doubtId: resolvedDoubtId })}\n\n`)
        );
        try {
          for await (const chunk of stream) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
          }
        } finally {
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();

          // Persist assistant reply
          void svc.from("messages").insert({
            doubt_id: resolvedDoubtId,
            role: "assistant",
            content: fullResponse,
          });

          // Auto-update revision note in background
          if (courseId) {
            void updateRevisionNote(svc, uid, documentId, courseId).catch(console.warn);
          }
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("chat route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * Silently regenerate the course revision note after every chat turn.
 * Fire-and-forget — never blocks the streaming response.
 */
async function updateRevisionNote(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
  documentId: string,
  courseId: string
) {
  const { data: notes } = await svc
    .from("notes")
    .select("content_md")
    .eq("course_id", courseId)
    .not("tags", "cs", '["revision"]');

  if (!notes?.length) return;

  const { data: courseRow } = await svc
    .from("courses")
    .select("name")
    .eq("id", courseId)
    .single();

  const courseName = courseRow?.name ?? "this course";
  const noteText = notes.map((n) => n.content_md).join("\n\n---\n\n");

  const sheet = await ai({
    task: "chat",
    messages: [
      { role: "system", content: revisionSheetPrompt(courseName) },
      { role: "user", content: noteText },
    ],
    noCache: true,
  });

  const { data: existing } = await svc
    .from("notes")
    .select("id")
    .eq("course_id", courseId)
    .contains("tags", ["revision"])
    .maybeSingle();

  if (existing) {
    await svc.from("notes").update({ content_md: sheet }).eq("id", existing.id);
  } else {
    await svc.from("notes").insert({
      user_id: userId,
      course_id: courseId,
      document_id: documentId,
      page_number: 1,
      content_md: sheet,
      source: "ai",
      tags: ["revision"],
    });
  }
}
