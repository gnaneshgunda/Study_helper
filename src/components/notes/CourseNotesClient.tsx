"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { type Course, type Note } from "@/types/database";
import {
  ChevronLeft, FileText, StickyNote, Wand2,
  Loader2, Copy, Check, Tag, Bot, User, MessageSquare, Pencil, Trash2
} from "lucide-react";
import { AppShell } from "@/components/ui/AppShell";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { NoteEditor } from "@/components/notes/NoteEditor";

type NoteWithMeta = Note & {
  documents?: {
    id: string;
    title: string;
    lectures?: { id: string; title: string; position: number } | null;
  } | null;
};

interface Props {
  course: Course;
  initialNotes: NoteWithMeta[];
  initialRevisionNote: Note | null;
}

const SOURCE_ICON: Record<Note["source"], React.ReactNode> = {
  manual: <User className="h-3 w-3" />,
  ai: <Bot className="h-3 w-3" />,
  doubt: <MessageSquare className="h-3 w-3" />,
};

export function CourseNotesClient({ course, initialNotes, initialRevisionNote }: Props) {
  const supabase = createClient();
  const [notes, setNotes] = useState<NoteWithMeta[]>(
    initialNotes.filter((n) => !n.tags.includes("revision"))
  );
  const [revisionNote, setRevisionNote] = useState<Note | null>(initialRevisionNote);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [generatingRevision, setGeneratingRevision] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(!!initialRevisionNote);

  // Collect all unique tags across notes
  const allTags = Array.from(new Set(notes.flatMap((n) => n.tags)));

  // Group notes by lecture
  const grouped = notes
    .filter((n) => !filterTag || n.tags.includes(filterTag))
    .reduce<Record<string, { lectureTitle: string; lecturePos: number; notes: NoteWithMeta[] }>>(
      (acc, note) => {
        const lec = note.documents?.lectures;
        const key = lec?.id ?? "unlinked";
        if (!acc[key]) {
          acc[key] = {
            lectureTitle: lec?.title ?? "Unlinked notes",
            lecturePos: lec?.position ?? 999,
            notes: [],
          };
        }
        acc[key].notes.push(note);
        return acc;
      },
      {}
    );

  const sortedGroups = Object.entries(grouped).sort(
    ([, a], [, b]) => a.lecturePos - b.lecturePos
  );

  async function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    await supabase.from("notes").delete().eq("id", id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  async function generateRevision() {
    setGeneratingRevision(true);
    try {
      const res = await fetch("/api/ai/revision-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);

      // Upsert the revision note
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (revisionNote) {
        const { data: updated } = await supabase
          .from("notes")
          .update({ content_md: body.sheet })
          .eq("id", revisionNote.id)
          .select()
          .single();
        if (updated) setRevisionNote(updated);
      } else {
        // Find a document to anchor this note to
        const firstNote = notes[0];
        if (!firstNote) { alert("Add some notes first, then generate a revision sheet."); return; }
        const { data: created } = await supabase
          .from("notes")
          .insert({
            user_id: user.id,
            course_id: course.id,
            document_id: firstNote.document_id,
            page_number: 1,
            content_md: body.sheet,
            source: "ai",
            tags: ["revision"],
          })
          .select()
          .single();
        if (created) setRevisionNote(created);
      }
      setRevisionOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate revision sheet");
    } finally {
      setGeneratingRevision(false);
    }
  }

  async function copyRevision() {
    if (!revisionNote) return;
    await navigator.clipboard.writeText(revisionNote.content_md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/courses/${course.id}`}
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 mb-3">
            <ChevronLeft className="h-3.5 w-3.5" /> Back to course
          </Link>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-1.5 rounded-full" style={{ backgroundColor: course.color }} />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{course.name} — Notes</h1>
                <p className="text-sm text-slate-400 mt-0.5">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <button
              onClick={generateRevision}
              disabled={generatingRevision || notes.length === 0}
              className="btn-primary flex-shrink-0"
            >
              {generatingRevision
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Wand2 className="h-4 w-4" />
              }
              {revisionNote ? "Regenerate revision" : "Generate revision sheet"}
            </button>
          </div>
        </div>

        {/* Revision sheet panel */}
        {revisionNote && (
          <div className="card mb-8 overflow-hidden">
            <button
              onClick={() => setRevisionOpen(!revisionOpen)}
              className="w-full flex items-center justify-between px-5 py-3 bg-brand-50 hover:bg-brand-100 transition-colors"
              aria-expanded={revisionOpen}
            >
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-brand-500" />
                <span className="font-semibold text-brand-700 text-sm">Revision Sheet</span>
                <span className="text-xs text-brand-400">AI-generated from your notes</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); copyRevision(); }}
                  className="btn-ghost text-xs py-1 px-2 text-brand-600"
                  aria-label="Copy revision sheet"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <span className="text-brand-400 text-xs">{revisionOpen ? "▲" : "▼"}</span>
              </div>
            </button>
            {revisionOpen && (
              <div className="px-5 py-4">
                <MarkdownRenderer content={revisionNote.content_md} />
              </div>
            )}
          </div>
        )}

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <Tag className="h-3.5 w-3.5 text-slate-400" />
            <button
              onClick={() => setFilterTag(null)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${!filterTag ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              All
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setFilterTag(filterTag === t ? null : t)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${filterTag === t ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Notes grouped by lecture */}
        {notes.length === 0 ? (
          <div className="text-center py-24">
            <StickyNote className="h-12 w-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500">No notes yet. Open a document and start taking notes.</p>
          </div>
        ) : sortedGroups.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-12">No notes match this filter.</p>
        ) : (
          <div className="space-y-8">
            {sortedGroups.map(([lectureId, group]) => (
              <section key={lectureId}>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  {group.lectureTitle}
                </h2>
                <div className="space-y-3">
                  {group.notes.map((note) => (
                    <div key={note.id} className="card overflow-hidden">
                      {editingNoteId === note.id ? (
                        <NoteEditor
                          note={note}
                          documentId={note.document_id}
                          courseId={course.id}
                          pageNumber={note.page_number}
                          source={note.source}
                          onSaved={(updated) => {
                            setNotes((prev) => prev.map((n) => n.id === updated.id ? { ...n, ...updated } : n));
                            setEditingNoteId(null);
                          }}
                          onCancel={() => setEditingNoteId(null)}
                        />
                      ) : (
                        <div className="p-4 group">
                          {/* Note meta */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              {SOURCE_ICON[note.source]}
                              <span>Slide {note.page_number}</span>
                              {note.documents && (
                                <>
                                  <span>·</span>
                                  <Link
                                    href={`/courses/${course.id}/lectures/${note.documents.lectures?.id}/documents/${note.documents.id}`}
                                    className="hover:text-brand-600 hover:underline truncate max-w-[180px]"
                                  >
                                    {note.documents.title}
                                  </Link>
                                </>
                              )}
                              {note.tags.map((t) => (
                                <span key={t} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs">{t}</span>
                              ))}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditingNoteId(note.id)} className="btn-ghost p-1" aria-label="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => deleteNote(note.id)} className="btn-ghost p-1 text-red-400 hover:text-red-600" aria-label="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <MarkdownRenderer content={note.content_md} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
