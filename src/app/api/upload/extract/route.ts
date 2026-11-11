import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { aiEmbed } from "@/lib/ai/complete";

export const runtime = "nodejs";
export const maxDuration = 120; // embeddings take time for large PDFs

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storagePath, lectureId, title } = await request.json() as {
      storagePath: string;
      lectureId: string;
      title: string;
    };

    if (!storagePath || !lectureId || !title) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const svc = await createServiceClient();

    // Verify lecture exists
    const { data: lecture } = await svc
      .from("lectures")
      .select("id")
      .eq("id", lectureId)
      .single();

    if (!lecture) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }

    // Download PDF bytes from Storage
    const { data: fileData, error: dlErr } = await svc.storage
      .from("slides")
      .download(storagePath);

    if (dlErr || !fileData) {
      return NextResponse.json({ error: "Could not fetch file from storage" }, { status: 500 });
    }

    // Extract text — pdf-parse runs pure Node, no worker needed
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const pages = await extractPdfText(buffer);

    // Insert document row
    const { data: doc, error: docErr } = await svc
      .from("documents")
      .insert({
        lecture_id: lectureId,
        storage_path: storagePath,
        title: title.trim() || "Untitled",
        page_count: pages.length,
      })
      .select()
      .single();

    if (docErr || !doc) {
      return NextResponse.json(
        { error: docErr?.message ?? "DB insert failed" },
        { status: 500 }
      );
    }

    // Insert page rows + generate embeddings
    if (pages.length > 0) {
      // Insert pages first without embeddings (fast)
      const { data: insertedPages, error: pageErr } = await svc.from("pages").insert(
        pages.map((text, idx) => ({
          document_id: doc.id,
          page_number: idx + 1,
          text,
        }))
      ).select("id, page_number, text");

      if (pageErr) {
        console.error("Page insert error:", pageErr.message);
      }

      // Generate embeddings in background (non-blocking — return doc immediately)
      // We fire-and-forget so the upload UX is fast
      if (insertedPages && process.env.GEMINI_API_KEY) {
        void embedPagesInBackground(insertedPages, svc);
      }
    }

    return NextResponse.json(doc);
  } catch (err) {
    console.error("extract route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * Embed pages in the background after upload returns.
 * Processes pages sequentially to stay within Gemini rate limits.
 */
async function embedPagesInBackground(
  pages: { id: string; page_number: number; text: string }[],
  svc: Awaited<ReturnType<typeof createServiceClient>>
) {
  for (const page of pages) {
    try {
      if (!page.text.trim()) continue; // skip image-only pages
      const embedding = await aiEmbed(page.text);
      await svc
        .from("pages")
        .update({ embedding: embedding as unknown as number[] })
        .eq("id", page.id);
      // Small delay to stay within Gemini free-tier rate limit (15 RPM)
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.warn(`Embedding failed for page ${page.page_number}:`, err);
    }
  }
}

/**
 * Extract per-page text using pdf-parse.
 * pdf-parse is a pure-Node library — no browser worker, no canvas, no DOM.
 */
async function extractPdfText(buffer: Buffer): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (
    buf: Buffer,
    opts?: Record<string, unknown>
  ) => Promise<{ numpages: number; text: string }>;

  const pageTexts: string[] = [];

  // pagerender is called once per page; we collect the text in order
  await pdfParse(buffer, {
    pagerender(pageData: {
      getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
    }) {
      return pageData.getTextContent().then((content) => {
        const text = content.items
          .map((item) => item.str ?? "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        pageTexts.push(text);
        return text;
      });
    },
  });

  return pageTexts;
}
