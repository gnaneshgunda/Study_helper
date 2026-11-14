import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { aiEmbed } from "@/lib/ai/complete";

export const runtime = "nodejs";
export const maxDuration = 55;

/**
 * Generate embeddings for pages that don't have them yet.
 * Called from the client after upload completes — keeps it alive
 * on Vercel serverless where background tasks after response die.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { documentId } = await request.json() as { documentId: string };
    if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });

    const svc = await createServiceClient();

    // Find pages without embeddings
    const { data: pages, error } = await svc
      .from("pages")
      .select("id, page_number, text")
      .eq("document_id", documentId)
      .is("embedding", null);

    if (error || !pages?.length) {
      return NextResponse.json({ embedded: 0, total: 0 });
    }

    let embedded = 0;
    for (const page of pages) {
      // Stop if we're approaching the time limit
      if (embedded > 0 && embedded % 20 === 0) {
        // Check if we should bail (rough time estimate: ~300ms per page)
        const elapsed = embedded * 0.4;
        if (elapsed > 50) break; // leave buffer
      }

      try {
        if (!page.text.trim()) continue;
        const embedding = await aiEmbed(page.text);
        await svc
          .from("pages")
          .update({ embedding: embedding as unknown as number[] })
          .eq("id", page.id);
        embedded++;
        // Small delay for Gemini rate limits
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        console.warn(`Embedding failed for page ${page.page_number}:`, err);
        // Continue to next page — don't fail the whole request
      }
    }

    return NextResponse.json({ embedded, total: pages.length });
  } catch (err) {
    console.error("embed route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
