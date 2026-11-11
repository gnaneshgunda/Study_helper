"use client";

import { useState } from "react";
import { type Note } from "@/types/database";
import { Plus, StickyNote } from "lucide-react";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { NoteCard } from "@/components/notes/NoteCard";

interface Props {
  documentId: string;
  courseId: string;
  currentPage: number;
  notes: Note[];
  /** If set, open this note in edit mode immediately (e.g. after save-from-chat) */
  openNoteId?: string | null;
  onNoteCreated: (note: Note) => void;
  onNoteUpdated: (note: Note) => void;
  onNoteDeleted: (id: string) => void;
}

export function NotesPanel({
  documentId,
  courseId,
  currentPage,
  notes,
  openNoteId = null,
  onNoteCreated,
  onNoteUpdated,
  onNoteDeleted,
}: Props) {
  const [editingId, setEditingId] = useState<string | "new" | null>(openNoteId);

  function handleCreated(note: Note) {
    onNoteCreated(note);
    setEditingId(note.id); // open the new note in editor right away
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 flex-shrink-0">
        <span className="text-xs text-slate-500 font-medium">
          Slide {currentPage} · {notes.length} note{notes.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setEditingId("new")}
          className="btn-ghost text-xs py-1 px-2"
          aria-label="Create new note"
        >
          <Plus className="h-3 w-3" aria-hidden="true" /> New note
        </button>
      </div>

      {/* New note editor */}
      {editingId === "new" && (
        <div className="border-b border-slate-100 flex-shrink-0">
          <NoteEditor
            documentId={documentId}
            courseId={courseId}
            pageNumber={currentPage}
            source="manual"
            onSaved={handleCreated}
            onCancel={() => setEditingId(null)}
          />
        </div>
      )}

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {notes.length === 0 && editingId !== "new" ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center px-4">
              <StickyNote className="h-8 w-8 text-slate-200 mx-auto mb-2" aria-hidden="true" />
              <p className="text-xs text-slate-400">No notes for this slide yet.</p>
              <button
                onClick={() => setEditingId("new")}
                className="btn-secondary text-xs mt-3 py-1.5"
              >
                <Plus className="h-3 w-3" aria-hidden="true" /> Add a note
              </button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100" aria-label="Notes for this slide">
            {notes.map((note) => (
              <li key={note.id}>
                {editingId === note.id ? (
                  <NoteEditor
                    note={note}
                    documentId={documentId}
                    courseId={courseId}
                    pageNumber={currentPage}
                    source={note.source}
                    onSaved={(updated) => {
                      onNoteUpdated(updated);
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <NoteCard
                    note={note}
                    onEdit={() => setEditingId(note.id)}
                    onDelete={() => onNoteDeleted(note.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
