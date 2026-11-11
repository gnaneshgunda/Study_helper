"use client";

import { useState } from "react";
import { type Note } from "@/types/database";
import { Pencil, Trash2, Tag, Bot, User, MessageSquare } from "lucide-react";
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

interface Props {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
}

export function NoteCard({ note, onEdit, onDelete }: Props) {
  const supabase = createClient();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this note?")) return;
    setDeleting(true);
    await supabase.from("notes").delete().eq("id", note.id);
    onDelete();
  }

  return (
    <div className="group px-3 py-3 hover:bg-slate-50 transition-colors">
      {/* Meta row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          {SOURCE_ICON[note.source]}
          <span>{SOURCE_LABEL[note.source]}</span>
          {note.tags.length > 0 && (
            <>
              <span>·</span>
              <Tag className="h-3 w-3" aria-hidden="true" />
              {note.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                >
                  {t}
                </span>
              ))}
            </>
          )}
        </div>

        {/* Actions — reveal on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="btn-ghost p-1"
            aria-label="Edit note"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-ghost p-1 text-red-400 hover:text-red-600"
            aria-label="Delete note"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Content */}
      <MarkdownRenderer content={note.content_md} />
    </div>
  );
}
