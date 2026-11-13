"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Doubt, type Note } from "@/types/database";
import { MessageSquare, StickyNote, Layers } from "lucide-react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { SectionExplainPanel } from "@/components/chat/SectionExplainPanel";

type Tab = "chat" | "explain" | "notes";

interface Props {
  documentId: string;
  courseId: string;
  currentPage: number;
  pageCount: number;
  lectureTitle: string;
  courseName: string;
}

export function SidePanel({ documentId, courseId, currentPage, pageCount, lectureTitle, courseName }: Props) {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("chat");
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  // Load doubts and notes for the current page whenever the page changes
  useEffect(() => {
    async function loadPageData() {
      const [doubtsRes, notesRes] = await Promise.all([
        supabase
          .from("doubts")
          .select("*")
          .eq("document_id", documentId)
          .eq("page_number", currentPage)
          .order("created_at", { ascending: false }),
        supabase
          .from("notes")
          .select("*")
          .eq("document_id", documentId)
          .eq("page_number", currentPage)
          .order("created_at", { ascending: false }),
      ]);
      setDoubts(doubtsRes.data ?? []);
      setNotes(notesRes.data ?? []);
    }
    loadPageData();
  }, [documentId, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDoubtCreated(doubt: Doubt) {
    setDoubts((prev) => [doubt, ...prev]);
  }

  function handleNoteCreated(note: Note) {
    setNotes((prev) => {
      if (prev.some((n) => n.id === note.id)) return prev;
      return [note, ...prev];
    });
    setOpenNoteId(note.id);
    setTab("notes");
  }

  function handleNoteUpdated(updated: Note) {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }

  function handleNoteDeleted(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar — three tabs */}
      <div className="flex border-b border-slate-200 flex-shrink-0">
        <TabButton active={tab === "chat"} onClick={() => setTab("chat")}
          icon={<MessageSquare className="h-4 w-4" aria-hidden="true" />}
          label="Doubt" badge={doubts.filter((d) => d.status === "open").length} />
        <TabButton active={tab === "explain"} onClick={() => setTab("explain")}
          icon={<Layers className="h-4 w-4" aria-hidden="true" />}
          label="Explain" badge={0} />
        <TabButton active={tab === "notes"} onClick={() => setTab("notes")}
          icon={<StickyNote className="h-4 w-4" aria-hidden="true" />}
          label="Notes" badge={notes.length} />
      </div>

      {/* Panel body */}
      <div className="flex-1 min-h-0">
        {tab === "chat" && (
          <ChatPanel
            documentId={documentId}
            courseId={courseId}
            currentPage={currentPage}
            lectureTitle={lectureTitle}
            courseName={courseName}
            doubts={doubts}
            onDoubtCreated={handleDoubtCreated}
            onSaveNote={handleNoteCreated}
          />
        )}
        {tab === "explain" && (
          <SectionExplainPanel
            documentId={documentId}
            courseId={courseId}
            currentPage={currentPage}
            pageCount={pageCount}
            lectureTitle={lectureTitle}
            courseName={courseName}
            onSaveNote={handleNoteCreated}
          />
        )}
        {tab === "notes" && (
          <NotesPanel
            documentId={documentId}
            courseId={courseId}
            currentPage={currentPage}
            notes={notes}
            openNoteId={openNoteId}
            onNoteCreated={handleNoteCreated}
            onNoteUpdated={handleNoteUpdated}
            onNoteDeleted={handleNoteDeleted}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active, onClick, icon, label, badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-3 text-xs font-medium border-b-2 transition-colors flex-1 justify-center ${
        active
          ? "border-brand-500 text-brand-600"
          : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200"
      }`}
      aria-selected={active}
      role="tab"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {badge > 0 && (
        <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 min-w-[1.25rem]">
          {badge}
        </span>
      )}
    </button>
  );
}
