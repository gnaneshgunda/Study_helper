"use client";

import { useState } from "react";
import { type Note } from "@/types/database";
import { Plus, FileText } from "lucide-react";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { NoteCard } from "@/components/notes/NoteCard";

interface Props {
  documentId: string;
  courseId: string;
  currentPage: number;
  pageCount: number;
  notes: Note[];
  openNoteId?: string | null;
  onNoteCreated: (note: Note) => void;
  onNoteUpdated: (note: Note) => void;
  onNoteDeleted: (id: string) => void;
}

export function NotesPanel({
  documentId, courseId, currentPage, pageCount, notes,
  openNoteId = null, onNoteCreated, onNoteUpdated, onNoteDeleted,
}: Props) {
  const [editingId, setEditingId] = useState<string | "new" | null>(openNoteId);

  function handleCreated(note: Note) {
    onNoteCreated(note);
    setEditingId(note.id);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header — document-wide, not slide-specific */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-200/70 flex-shrink-0 bg-stone-50/50">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-stone-400" aria-hidden="true" />
          <span className="text-xs text-stone-500 font-medium">
            {notes.length} note{notes.length !== 1 ? "s" : ""} in this document
          </span>
        </div>
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

      {/* Notes list — file-like cards for the whole document */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {notes.length === 0 && editingId !== "new" ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center px-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 mx-auto mb-3">
                <FileText className="h-6 w-6 text-stone-300" aria-hidden="true" />
              </div>
              <p className="text-sm text-stone-500 font-medium mb-1">No notes in this document yet</p>
              <p className="text-xs text-stone-400 max-w-xs mx-auto mb-4">
                Ask the AI about a slide and save the answer, or write your own.
                Notes stay linked to their slide so you can jump back.
              </p>
              <button onClick={() => setEditingId("new")} className="btn-secondary text-xs py-2">
                <Plus className="h-3 w-3" aria-hidden="true" /> Add a note
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-stone-100" aria-label="Notes for this document">
            {notes.map((note) => (
              <div key={note.id}>
                {editingId === note.id ? (
                  <NoteEditor
                    note={note}
                    documentId={documentId}
                    courseId={courseId}
                    pageNumber={note.page_number}
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
                    showSlideBadge={true}
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
