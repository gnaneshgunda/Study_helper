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
  openNoteId?: string | null;
  onNoteCreated: (note: Note) => void;
  onNoteUpdated: (note: Note) => void;
  onNoteDeleted: (id: string) => void;
}

export function NotesPanel({
  documentId, courseId, currentPage, notes,
  openNoteId = null, onNoteCreated, onNoteUpdated, onNoteDeleted,
}: Props) {
  const [editingId, setEditingId] = useState<string | "new" | null>(openNoteId);

  function handleCreated(note: Note) {
    onNoteCreated(note);
    setEditingId(note.id);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-200/70 flex-shrink-0 bg-stone-50/50">
        <span className="text-xs text-stone-500 font-medium">
          Slide {currentPage} · {notes.length} note{notes.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setEditingId("new")}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-all"
          aria-label="Create new note"
        >
          <Plus className="h-3 w-3" aria-hidden="true" /> New
        </button>
      </div>

      {/* New note editor */}
      {editingId === "new" && (
        <div className="border-b border-stone-200/70 flex-shrink-0">
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

      {/* Notes list — accordion cards */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {notes.length === 0 && editingId !== "new" ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center px-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 mx-auto mb-3">
                <StickyNote className="h-6 w-6 text-stone-300" aria-hidden="true" />
              </div>
              <p className="text-sm text-stone-500 font-medium mb-1">No notes on slide {currentPage} yet</p>
              <p className="text-xs text-stone-400 max-w-xs mx-auto mb-4">
                Write your own, or save an AI answer from the Doubt tab.
                Notes stay pinned to this slide.
              </p>
              <button onClick={() => setEditingId("new")} className="btn-secondary text-xs py-2">
                <Plus className="h-3 w-3" aria-hidden="true" /> Add a note
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-stone-100" aria-label="Notes for this slide">
            {notes.map((note) => (
              <div key={note.id}>
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
                    defaultExpanded={openNoteId === note.id}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
