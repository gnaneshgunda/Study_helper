"use client";

import { useState } from "react";
import { type Note } from "@/types/database";
import { Pencil, Trash2, Bot, User, MessageSquare, ChevronDown, Loader2 } from "lucide-react";
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
  // Try ## Heading
  const headingMatch = content.match(/^##\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim().slice(0, 80);

  // Try **Concept:** line
  const conceptMatch = content.match(/\*\*Concept:\*\*\s*(.+)/);
  if (conceptMatch) return conceptMatch[1].trim().slice(0, 80);

  // Try first non-empty line, strip markdown
  const firstLine = content.trim().split("\n")[0]?.replace(/[#*_`>]/g, "").trim();
  if (firstLine) return firstLine.slice(0, 80);

  return "Untitled note";
}

/** Extract a short preview (first ~100 chars without markdown) */
function extractPreview(content: string): string {
  const cleaned = content
    .replace(/^##.*$/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\$[^$]+\$/g, "[formula]")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 100) + (cleaned.length > 100 ? "…" : "");
}

interface Props {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
  /** Default expanded state */
  defaultExpanded?: boolean;
}

export function NoteCard({ note, onEdit, onDelete, defaultExpanded = false }: Props) {
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
      {/* Title row */}
      <div className="flex items-start gap-2">
        {/* Source icon */}
        <div className="flex items-center gap-1.5 mt-0.5 flex-shrink-0">
          {SOURCE_ICON[note.source]}
        </div>

        {/* Title + preview */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-800 leading-snug">
            {title}
          </p>
          {!expanded && (
            <p className="text-xs text-stone-400 mt-0.5 leading-relaxed truncate">
              {preview || note.content_md.slice(0, 80) + "…"}
            </p>
          )}
        </div>

        {/* Chevron */}
        <ChevronDown
          className={`h-4 w-4 text-stone-300 flex-shrink-0 mt-1 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </div>

      {/* Tags row — always visible */}
      {note.tags.length > 0 && (
        <div className="flex items-center gap-1.5 mt-1.5 ml-6">
          {note.tags.map((t) => (
            <span key={t} className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500 font-medium">
              {t}
            </span>
          ))}
          {note.topic && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] text-brand-600 font-medium">
              {note.topic}
            </span>
          )}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 ml-6 fade-in-up">
          {/* Source label */}
          <div className="text-[10px] text-stone-300 mb-2 flex items-center gap-1">
            {SOURCE_LABEL[note.source]}
          </div>

          {/* Full content */}
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
