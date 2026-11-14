"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { type Course, type Note } from "@/types/database";
import {
  ChevronLeft, FileText, StickyNote, Wand2,
  Loader2, Copy, Check, Tag, Bot, User, MessageSquare, Pencil, Trash2,
  Layers, FolderOpen,
} from "lucide-react";
import { AppShell } from "@/components/ui/AppShell";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { NoteCard } from "@/components/notes/NoteCard";

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

type GroupMode = "topic" | "lecture";

export function CourseNotesClient({ course, initialNotes, initialRevisionNote }: Props) {
  const supabase = createClient();
  const [notes, setNotes] = useState<NoteWithMeta[]>(
    initialNotes.filter((n) => !n.tags.includes("revision"))
  );
  const [revisionNote, setRevisionNote] = useState<Note | null>(initialRevisionNote);
  const [groupMode, setGroupMode] = useState<GroupMode>("topic");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [generatingRevision, setGeneratingRevision] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(!!initialRevisionNote);

  const allTags = Array.from(new Set(notes.flatMap((n) => n.tags)));
  const filtered = notes.filter((n) => !filterTag || n.tags.includes(filterTag));

  // Group by topic
  const topicGroups = filtered.reduce<Record<string, NoteWithMeta[]>>((acc, note) => {
    const topic = note.topic || "Uncategorised";
    if (!acc[topic]) acc[topic] = [];
    acc[topic].push(note);
    return acc;
  }, {});
  const sortedTopics = Object.entries(topicGroups).sort(([a], [b]) =>
    a === "Uncategorised" ? 1 : b === "Uncategorised" ? -1 : a.localeCompare(b)
  );

  // Group by lecture
  const lectureGroups = filtered.reduce<Record<string, { title: string; pos: number; notes: NoteWithMeta[] }>>(
    (acc, note) => {
      const lec = note.documents?.lectures;
      const key = lec?.id ?? "unlinked";
      if (!acc[key]) acc[key] = { title: lec?.title ?? "Unlinked", pos: lec?.position ?? 999, notes: [] };
      acc[key].notes.push(note);
      return acc;
    }, {}
  );
  const sortedLectures = Object.entries(lectureGroups).sort(([, a], [, b]) => a.pos - b.pos);

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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (revisionNote) {
        const { data: updated } = await supabase
          .from("notes").update({ content_md: body.sheet }).eq("id", revisionNote.id).select().single();
        if (updated) setRevisionNote(updated);
      } else {
        const firstNote = notes[0];
        if (!firstNote) { alert("Add some notes first."); return; }
        const { data: created } = await supabase
          .from("notes").insert({
            user_id: user.id, course_id: course.id, document_id: firstNote.document_id,
            page_number: 1, content_md: body.sheet, source: "ai", tags: ["revision"],
          }).select().single();
        if (created) setRevisionNote(created);
      }
      setRevisionOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
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

  const groups = groupMode === "topic" ? sortedTopics : sortedLectures;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/courses/${course.id}`} className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 mb-3">
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
            <button onClick={generateRevision} disabled={generatingRevision || notes.length === 0} className="btn-primary flex-shrink-0">
              {generatingRevision ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {revisionNote ? "Regenerate" : "Revision sheet"}
            </button>
          </div>
        </div>

        {/* Revision sheet */}
        {revisionNote && (
          <div className="card mb-8 overflow-hidden">
            <button onClick={() => setRevisionOpen(!revisionOpen)}
              className="w-full flex items-center justify-between px-5 py-3 bg-brand-50 hover:bg-brand-100 transition-colors"
              aria-expanded={revisionOpen}
            >
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-brand-500" />
                <span className="font-semibold text-brand-700 text-sm">Revision Sheet</span>
                <span className="text-xs text-brand-400">Auto-updates after each doubt</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); copyRevision(); }} className="btn-ghost text-xs py-1 px-2 text-brand-600">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <span className="text-brand-400 text-xs">{revisionOpen ? "▲" : "▼"}</span>
              </div>
            </button>
            {revisionOpen && (
              <div className="px-5 py-4"><MarkdownRenderer content={revisionNote.content_md} /></div>
            )}
          </div>
        )}

        {/* Group mode toggle + tag filter */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            <button onClick={() => setGroupMode("topic")}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${groupMode === "topic" ? "bg-brand-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
              <Layers className="h-3.5 w-3.5" /> Topic
            </button>
            <button onClick={() => setGroupMode("lecture")}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${groupMode === "lecture" ? "bg-brand-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
              <FolderOpen className="h-3.5 w-3.5" /> Lecture
            </button>
          </div>

          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="h-3.5 w-3.5 text-slate-400" />
              <button onClick={() => setFilterTag(null)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${!filterTag ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>All</button>
              {allTags.map((t) => (
                <button key={t} onClick={() => setFilterTag(filterTag === t ? null : t)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${filterTag === t ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{t}</button>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        {notes.length === 0 ? (
          <div className="text-center py-24">
            <StickyNote className="h-12 w-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 mb-1">No notes yet.</p>
            <p className="text-sm text-slate-400 max-w-xs mx-auto">
              Open a document, ask the AI about a slide, and save the answer as a note.
              Or use Explain mode to get a connected walkthrough of multiple slides.
            </p>
          </div>
        ) : groups.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-12">No notes match this filter.</p>
        ) : (
          <div className="space-y-8">
            {groups.map(([key, group]) => {
              const groupNotes = groupMode === "topic"
                ? (group as NoteWithMeta[])
                : (group as { title: string; notes: NoteWithMeta[] }).notes;
              const title = groupMode === "topic" ? key : (group as { title: string }).title;
              const Icon = groupMode === "topic" ? Layers : FileText;

              return (
                <section key={key}>
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" /> {title}
                    <span className="text-slate-300 normal-case tracking-normal">({groupNotes.length})</span>
                  </h2>
                  <div className="space-y-3">
                    {groupNotes.map((note) => (
                      <div key={note.id} className="card overflow-hidden">
                        {editingNoteId === note.id ? (
                          <NoteEditor note={note} documentId={note.document_id} courseId={course.id}
                            pageNumber={note.page_number} source={note.source}
                            onSaved={(updated) => {
                              setNotes((prev) => prev.map((n) => n.id === updated.id ? { ...n, ...updated } : n));
                              setEditingNoteId(null);
                            }}
                            onCancel={() => setEditingNoteId(null)} />
                        ) : (
                          <div>
                            <NoteCard
                              note={note}
                              onEdit={() => setEditingNoteId(note.id)}
                              onDelete={() => deleteNote(note.id)}
                            />
                            <div className="flex items-center gap-1.5 px-4 pb-2 text-xs text-stone-400">
                              <span>Slide {note.page_number}</span>
                              {note.documents && (
                                <>
                                  <span>·</span>
                                  <Link href={`/courses/${course.id}/lectures/${note.documents.lectures?.id}/documents/${note.documents.id}`}
                                    className="hover:text-brand-600 hover:underline truncate max-w-[180px]">
                                    {note.documents.title}
                                  </Link>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
