"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, BookmarkPlus, Layers, ChevronRight } from "lucide-react";
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
  const trackRef = useRef<HTMLDivElement>(null);
  const explanationRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync range when current page changes
  useEffect(() => {
    setPageStart(currentPage);
    setPageEnd(Math.min(currentPage + 2, pageCount));
  }, [currentPage, pageCount]);

  // Auto-scroll the strip to show the current selection
  useEffect(() => {
    if (scrollRef.current && pageCount > 20) {
      const tileWidth = 28; // approximate width per tile + gap
      const scrollTo = Math.max(0, (pageStart - 3) * tileWidth);
      scrollRef.current.scrollLeft = scrollTo;
    }
  }, [pageStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCount = pageEnd - pageStart + 1;

  // Handle click on a page tile
  let clickMode: "start" | "end" = "start";
  function handlePageClick(page: number) {
    // If clicking left of start → extend start
    // If clicking right of end → extend end
    // If clicking between → snap nearest edge
    if (page <= pageStart) {
      setPageStart(page);
    } else if (page >= pageEnd) {
      setPageEnd(page);
    } else {
      // Between start and end — snap to whichever is closer
      const distToStart = page - pageStart;
      const distToEnd = pageEnd - page;
      if (distToStart <= distToEnd) setPageStart(page);
      else setPageEnd(page);
    }
  }

  function setRange(start: number, end: number) {
    setPageStart(Math.max(1, start));
    setPageEnd(Math.min(pageCount, end));
  }

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

  // Generate preset ranges
  const presets = [
    { label: "Just this slide", range: [currentPage, currentPage] as const, desc: `Slide ${currentPage}` },
    { label: "Context ±2", range: [Math.max(1, currentPage - 2), Math.min(pageCount, currentPage + 2)] as const,
      desc: `${Math.max(1, currentPage - 2)}–${Math.min(pageCount, currentPage + 2)}` },
    { label: "Context ±5", range: [Math.max(1, currentPage - 5), Math.min(pageCount, currentPage + 5)] as const,
      desc: `${Math.max(1, currentPage - 5)}–${Math.min(pageCount, currentPage + 5)}` },
    { label: "Everything", range: [1, pageCount] as const, desc: `All ${pageCount} slides` },
  ];

  const isPresetActive = (start: number, end: number) => pageStart === start && pageEnd === end;

  return (
    <div className="flex flex-col h-full">
      {/* ── Selection area ── */}
      <div className="px-4 pt-4 pb-3 border-b border-stone-200/70 flex-shrink-0 bg-stone-50/50">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50">
            <Layers className="h-4 w-4 text-brand-500" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-800">Explain a section</p>
            <p className="text-xs text-stone-400">Pick slides to get a connected walkthrough</p>
          </div>
        </div>

        {/* Visual page strip */}
        <div ref={scrollRef} className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "thin" }}>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => {
            const isSelected = pageNum >= pageStart && pageNum <= pageEnd;
            const isCurrent = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                onClick={() => handlePageClick(pageNum)}
                className={`relative flex flex-col items-center justify-center flex-shrink-0 rounded-lg transition-all
                  ${isSelected
                    ? "bg-brand-500 text-white shadow-sm"
                    : "bg-white text-stone-400 border border-stone-200 hover:border-brand-300 hover:text-stone-600"}
                  ${isCurrent ? "ring-2 ring-amber-400 ring-offset-1" : ""}
                `}
                style={{ width: 26, height: 32 }}
                aria-label={`Slide ${pageNum}${isSelected ? " (selected)" : ""}${isCurrent ? " (current)" : ""}`}
                aria-pressed={isSelected}
              >
                <span className="text-[10px] font-bold tabular-nums">{pageNum}</span>
              </button>
            );
          })}
        </div>

        {/* Selected range summary — big and clear */}
        <div className="flex items-center justify-center gap-2 mt-2 mb-3">
          <span className="text-sm font-bold text-stone-800 tabular-nums">{pageStart}</span>
          <ChevronRight className="h-3.5 w-3.5 text-stone-300" aria-hidden="true" />
          <span className="text-sm font-bold text-stone-800 tabular-nums">{pageEnd}</span>
          <span className="text-xs text-stone-400 ml-1">· {selectedCount} slide{selectedCount !== 1 ? "s" : ""}</span>
        </div>

        {/* Presets — show actual page numbers */}
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {presets.map((preset) => {
            const [s, e] = preset.range;
            const active = isPresetActive(s, e);
            return (
              <button
                key={preset.label}
                onClick={() => setRange(s, e)}
                className={`flex flex-col items-start rounded-xl px-3 py-2 transition-all text-left
                  ${active
                    ? "bg-brand-500 text-white shadow-sm"
                    : "bg-white border border-stone-200 text-stone-600 hover:border-brand-300 hover:bg-brand-50/50"}`}
                aria-pressed={active}
              >
                <span className="text-xs font-medium">{preset.label}</span>
                <span className={`text-[10px] tabular-nums ${active ? "text-brand-100" : "text-stone-400"}`}>
                  {preset.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* Explain button — big and prominent */}
        <button
          onClick={explain}
          disabled={loading || pageEnd < pageStart}
          className="btn-primary w-full justify-center py-3"
        >
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Reading slides…</>
            : <><Sparkles className="h-4 w-4" aria-hidden="true" /> Explain slides {pageStart}–{pageEnd}</>
          }
        </button>
      </div>

      {/* ── Explanation output ── */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0" ref={explanationRef}>
        {loading && !explanation && (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand-400 mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm text-stone-500 font-medium">Reading slides {pageStart}–{pageEnd}…</p>
              <p className="text-xs text-stone-400 mt-1">Connecting ideas across pages</p>
            </div>
          </div>
        )}

        {explanation && (
          <div className="fade-in-up">
            {/* Summary badge */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50">
                <Layers className="h-3.5 w-3.5 text-brand-500" aria-hidden="true" />
              </div>
              <span className="text-xs font-medium text-stone-500">
                Slides {pageStart}–{pageEnd} · {selectedCount} slides explained
              </span>
            </div>

            <MarkdownRenderer content={explanation} />

            <button
              onClick={saveAsNote}
              disabled={saving}
              className="btn-secondary text-sm mt-5 w-full justify-center py-2.5"
            >
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <BookmarkPlus className="h-4 w-4" aria-hidden="true" />}
              Save as note
            </button>
          </div>
        )}

        {!loading && !explanation && !error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4 max-w-[260px]">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 mx-auto mb-3">
                <Layers className="h-7 w-7 text-brand-300" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-stone-600 mb-1">Pick slides above</p>
              <p className="text-xs text-stone-400 leading-relaxed">
                Select a range of slides and get a connected explanation —
                how the ideas flow from one slide to the next, organised by subtopic.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
