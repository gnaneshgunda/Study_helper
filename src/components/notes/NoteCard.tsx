"use client";

import { useState } from "react";
import { type Note } from "@/types/database";
import { Pencil, Trash2, Bot, User, MessageSquare, ChevronDown, Loader2, FileText } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { createClient } from "@/lib/supabase/client";

const SOURCE_ICON: Record<Note["source"], React.ReactNode> = {
  manual: <User className="h-3 w-3" aria-hidden="true" />,
  ai: <Bot className="h-3 w-3" aria-hidden="true" />,
  doubt: <MessageSquare className="h-3 w-3" aria-hidden="true" />,
};
const SOURCE_LABEL: Record<Note["source"], string> = {
  manual: "Manual",
  ai: "From AI",
  doubt: "From doubt",
};

/** Extract a readable title from note content */
function extractTitle(content: string): string {
  const headingMatch = content.match(/^##\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim().slice(0, 80);
  const conceptMatch = content.match(/\*\*Concept:\*\*\s*(.+)/);
  if (conceptMatch) return conceptMatch[1].trim().slice(0, 80);
  const firstLine = content.trim().split("\n")[0]?.replace(/[#*_`>]/g, "").trim();
  if (firstLine) return firstLine.slice(0, 80);
  return "Untitled note";
}

/** Extract a short preview */
function extractPreview(content: string): string {
  const cleaned = content
    .replace(/^##.*$/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\$[^$]+\$/g, "[formula]")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 120) + (cleaned.length > 120 ? "…" : "");
}

interface Props {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
  defaultExpanded?: boolean;
  /** Show "Slide X" badge (when notes span multiple slides) */
  showSlideBadge?: boolean;
}

export function NoteCard({ note, onEdit, onDelete, defaultExpanded = false, showSlideBadge = false }: Props) {
  const supabase = createClient();
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const title = extractTitle(note.content_md);
  const preview = extractPreview(note.content_md);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this note?")) return;
    setDeleting(true);
    await supabase.from("notes").delete().eq("id", note.id);
    onDelete();
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation();
    onEdit();
  }

  return (
    <div
      className="group px-4 py-3 hover:bg-stone-50 transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
    >
      {/* File-like row: icon + title */}
      <div className="flex items-start gap-2.5">
        {/* File icon */}
        <div className="mt-0.5 flex-shrink-0">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${expanded ? "bg-brand-50" : "bg-stone-100"}`}>
            <FileText className={`h-4 w-4 transition-colors ${expanded ? "text-brand-500" : "text-stone-400"}`} aria-hidden="true" />
          </div>
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-800 leading-snug">
            {title}
          </p>

          {/* Meta row: source + slide badge + tags */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {SOURCE_ICON[note.source]}
            <span className="text-[10px] text-stone-400">{SOURCE_LABEL[note.source]}</span>

            {showSlideBadge && (
              <span className="flex items-center gap-0.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-600 font-medium">
                Slide {note.page_number}
              </span>
            )}

            {note.topic && (
              <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500 font-medium">
                {note.topic}
              </span>
            )}

            {note.tags.map((t) => (
              <span key={t} className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-400">
                {t}
              </span>
            ))}
          </div>

          {/* Preview when collapsed */}
          {!expanded && (
            <p className="text-xs text-stone-400 mt-1 leading-relaxed line-clamp-2">
              {preview || note.content_md.slice(0, 100) + "…"}
            </p>
          )}
        </div>

        {/* Chevron */}
        <ChevronDown
          className={`h-4 w-4 text-stone-300 flex-shrink-0 mt-2 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 ml-10.5 fade-in-up">
          <MarkdownRenderer content={note.content_md} />

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleEdit}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-all"
            >
              <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-stone-400 hover:bg-red-50 hover:text-red-500 transition-all"
            >
              {deleting
                ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                : <Trash2 className="h-3 w-3" aria-hidden="true" />
              } Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
