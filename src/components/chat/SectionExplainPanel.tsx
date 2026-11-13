"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, BookmarkPlus, Layers } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { createClient } from "@/lib/supabase/client";
import { type Note } from "@/types/database";

interface Props {
  documentId: string;
  courseId: string;
  currentPage: number;
  pageCount: number;
  lectureTitle: string;
  courseName: string;
  onSaveNote: (note: Note) => void;
}

export function SectionExplainPanel({
  documentId, courseId, currentPage, pageCount, lectureTitle, courseName, onSaveNote,
}: Props) {
  const supabase = createClient();
  const [pageStart, setPageStart] = useState(currentPage);
  const [pageEnd, setPageEnd] = useState(Math.min(currentPage + 2, pageCount));
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const explanationRef = useRef<HTMLDivElement>(null);

  // Sync range when current page changes
  useEffect(() => {
    setPageStart(currentPage);
    setPageEnd(Math.min(currentPage + 2, pageCount));
  }, [currentPage, pageCount]);

  async function explain() {
    if (pageEnd < pageStart) return;
    setLoading(true);
    setError(null);
    setExplanation("");

    try {
      const res = await fetch("/api/ai/explain-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, pageStart, pageEnd, courseName, lectureTitle }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          const parsed = JSON.parse(payload);
          if (parsed.chunk) {
            acc += parsed.chunk;
            setExplanation(acc);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to explain");
    } finally {
      setLoading(false);
    }
  }

  async function saveAsNote() {
    if (!explanation.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: note, error: noteErr } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          course_id: courseId,
          document_id: documentId,
          page_number: pageStart,
          content_md: explanation,
          source: "ai",
          tags: [`slides-${pageStart}-${pageEnd}`],
        })
        .select()
        .single();
      if (!noteErr && note) onSaveNote(note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Range selector */}
      <div className="p-3 border-b border-slate-100 flex-shrink-0 bg-slate-50">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="h-4 w-4 text-brand-500" aria-hidden="true" />
          <span className="text-xs font-medium text-slate-700">Explain a section</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500 text-xs">Slides</span>
          <input
            type="number"
            min={1}
            max={pageCount}
            value={pageStart}
            onChange={(e) => setPageStart(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-14 text-center input py-1 text-sm"
            aria-label="Start page"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="number"
            min={1}
            max={pageCount}
            value={pageEnd}
            onChange={(e) => setPageEnd(Math.min(pageCount, parseInt(e.target.value) || pageCount))}
            className="w-14 text-center input py-1 text-sm"
            aria-label="End page"
          />
          <button
            onClick={explain}
            disabled={loading || pageEnd < pageStart}
            className="btn-primary text-xs py-1.5 px-3 ml-auto"
          >
            {loading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
            Explain
          </button>
        </div>
        {/* Quick range presets */}
        <div className="flex gap-1 mt-2">
          {[
            { label: "This slide", start: currentPage, end: currentPage },
            { label: "±2", start: Math.max(1, currentPage - 2), end: Math.min(pageCount, currentPage + 2) },
            { label: "±5", start: Math.max(1, currentPage - 5), end: Math.min(pageCount, currentPage + 5) },
            { label: "All", start: 1, end: pageCount },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => { setPageStart(preset.start); setPageEnd(preset.end); }}
              className="rounded-full bg-slate-100 hover:bg-brand-100 hover:text-brand-700 px-2 py-0.5 text-xs text-slate-500 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Explanation output */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0" ref={explanationRef}>
        {loading && !explanation && (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500 mx-auto mb-2" aria-hidden="true" />
              <p className="text-xs text-slate-400">Reading slides {pageStart}–{pageEnd}…</p>
            </div>
          </div>
        )}

        {explanation && (
          <>
            <div className="mb-3">
              <span className="text-xs font-medium text-slate-400">
                Explanation of slides {pageStart}–{pageEnd}
              </span>
            </div>
            <MarkdownRenderer content={explanation} />

            <button
              onClick={saveAsNote}
              disabled={saving}
              className="btn-secondary text-xs mt-4 w-full justify-center"
            >
              {saving
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                : <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />}
              Save as note
            </button>
          </>
        )}

        {!loading && !explanation && !error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4">
              <Layers className="h-10 w-10 text-slate-200 mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm text-slate-400 font-medium mb-1">Section Explain</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Pick a range of slides and get a connected explanation of the whole topic —
                how the ideas flow from one slide to the next.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
