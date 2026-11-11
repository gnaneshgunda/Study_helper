import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60; // allow time for large PDFs

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

    // Verify the user owns this lecture (via service client for RLS bypass on reads)
    const serviceClient = await createServiceClient();
    const { data: lecture } = await serviceClient
      .from("lectures")
      .select("id, course_id, courses(user_id)")
      .eq("id", lectureId)
      .single();

    if (!lecture) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }

    // Download the PDF bytes from Storage
    const { data: fileData, error: dlErr } = await serviceClient.storage
      .from("slides")
      .download(storagePath);

    if (dlErr || !fileData) {
      return NextResponse.json({ error: "Could not fetch file from storage" }, { status: 500 });
    }

    // Extract text with pdfjs-dist
    const arrayBuffer = await fileData.arrayBuffer();
    const pages = await extractPdfText(arrayBuffer);

    // Insert document row
    const { data: doc, error: docErr } = await serviceClient
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
      return NextResponse.json({ error: docErr?.message ?? "DB insert failed" }, { status: 500 });
    }

    // Insert page rows (batch)
    if (pages.length > 0) {
      const pageRows = pages.map((text, idx) => ({
        document_id: doc.id,
        page_number: idx + 1,
        text,
      }));

      const { error: pageErr } = await serviceClient.from("pages").insert(pageRows);
      if (pageErr) {
        console.error("Page insert error:", pageErr.message);
        // Non-fatal — document is still usable
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
 * Extract plain text from each page of a PDF using pdfjs-dist.
 * Falls back to empty string on pages that fail (image-only slides).
 *
 * Node.js pattern: set workerSrc to the absolute file:// URL of the
 * worker bundle so pdfjs can spawn it as a worker_threads Worker.
 */
async function extractPdfText(buffer: ArrayBuffer): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const path = await import("path");

  // Resolve the worker path relative to node_modules at runtime
  const workerPath = path.resolve(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
  }).promise;
  const results: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      results.push(text);
    } catch {
      results.push(""); // image-only page — vision fallback happens at chat time
    }
  }

  return results;
}
