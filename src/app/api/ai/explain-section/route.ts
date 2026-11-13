import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { aiStream } from "@/lib/ai/complete";
import { sectionExplainSystem } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { documentId, pageStart, pageEnd, courseName, lectureTitle } = await request.json() as {
      documentId: string;
      pageStart: number;
      pageEnd: number;
      courseName: string;
      lectureTitle: string;
    };

    if (!documentId || !pageStart || !pageEnd || pageEnd < pageStart) {
      return NextResponse.json({ error: "Invalid page range" }, { status: 400 });
    }

    const svc = await createServiceClient();

    // Fetch all pages in the range
    const pageNumbers = Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart + i);
    const { data: pages } = await svc
      .from("pages")
      .select("page_number, text")
      .eq("document_id", documentId)
      .in("page_number", pageNumbers)
      .order("page_number", { ascending: true });

    if (!pages?.length) {
      return NextResponse.json({ error: "No text found for those pages" }, { status: 400 });
    }

    const pagesText = pages
      .map((p) => `[Slide ${p.page_number}]: ${p.text || "(no text — likely image-only)"}`)
      .join("\n\n");

    const systemPrompt = sectionExplainSystem({
      course_name: courseName,
      lecture_title: lectureTitle,
      page_start: pageStart,
      page_end: pageEnd,
      pages_text: pagesText,
    });

    const stream = await aiStream({
      task: "chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Please explain slides ${pageStart} to ${pageEnd} of ${lectureTitle}.` },
      ],
      noCache: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
          }
        } finally {
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
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
    console.error("explain-section error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
