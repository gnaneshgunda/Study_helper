import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { aiStream } from "@/lib/ai/complete";
import { doubtTutorSystem } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequest {
  doubtId: string;      // existing doubt to continue, OR empty string for new
  documentId: string;
  pageNumber: number;
  courseName: string;
  lectureTitle: string;
  userMessage: string;
  /** Client-supplied title when creating a new doubt */
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

    // ── 1. Resolve or create the doubt ─────────────────────────────────────
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

    // ── 2. Persist the user message ─────────────────────────────────────────
    await svc.from("messages").insert({
      doubt_id: resolvedDoubtId,
      role: "user",
      content: userMessage.trim(),
    });

    // ── 3. Fetch slide context (current ± 1) ────────────────────────────────
    const { data: pages } = await svc
      .from("pages")
      .select("page_number, text")
      .eq("document_id", documentId)
      .in("page_number", [pageNumber - 1, pageNumber, pageNumber + 1]);

    const pageMap = Object.fromEntries((pages ?? []).map((p) => [p.page_number, p.text]));

    // ── 4. Fetch prior messages in this thread for context ──────────────────
    const { data: history } = await svc
      .from("messages")
      .select("role, content")
      .eq("doubt_id", resolvedDoubtId)
      .order("created_at", { ascending: true })
      .limit(20); // keep context manageable

    const priorMessages = (history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // ── 5. Build message array ───────────────────────────────────────────────
    const systemPrompt = doubtTutorSystem({
      course_name: courseName,
      page: pageNumber,
      lecture_title: lectureTitle,
      slide_text: pageMap[pageNumber] ?? "(no text extracted)",
      prev_slide_text: pageMap[pageNumber - 1] ?? "(none)",
      next_slide_text: pageMap[pageNumber + 1] ?? "(none)",
    });

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...priorMessages,
    ];

    // ── 6. Stream response ───────────────────────────────────────────────────
    const stream = await aiStream({ task: "chat", messages, noCache: true });

    const encoder = new TextEncoder();
    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        // First chunk: send the doubtId so the client can store it
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ doubtId: resolvedDoubtId })}\n\n`)
        );

        try {
          for await (const chunk of stream) {
            fullResponse += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`)
            );
          }
        } finally {
          // Signal done
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();

          // Persist assistant reply (fire-and-forget)
          void svc.from("messages").insert({
            doubt_id: resolvedDoubtId,
            role: "assistant",
            content: fullResponse,
          });
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
