"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Doubt, type Note, type Message } from "@/types/database";
import { Send, Plus, Loader2, ChevronDown, BookmarkPlus, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

interface Props {
  documentId: string;
  courseId: string;
  currentPage: number;
  lectureTitle: string;
  courseName: string;
  doubts: Doubt[];
  onDoubtCreated: (doubt: Doubt) => void;
  onSaveNote: (note: Note) => void;
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export function ChatPanel({
  documentId,
  courseId,
  currentPage,
  lectureTitle,
  courseName,
  doubts,
  onDoubtCreated,
  onSaveNote,
}: Props) {
  const supabase = createClient();
  const [activeDoubtId, setActiveDoubtId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [savingNote, setSavingNote] = useState<string | null>(null); // messageId being saved
  const [convertingDoubt, setConvertingDoubt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDoubts, setShowDoubts] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load messages when switching to an existing doubt
  useEffect(() => {
    if (!activeDoubtId) return;
    supabase
      .from("messages")
      .select("*")
      .eq("doubt_id", activeDoubtId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setMessages(data.map((m) => ({ id: m.id, role: m.role as "user"|"assistant", content: m.content })));
        }
      });
  }, [activeDoubtId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);
    setError(null);

    // Optimistic user bubble
    const userMsgId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", content: text }]);

    // Add a streaming assistant placeholder
    const asstMsgId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: asstMsgId, role: "assistant", content: "", streaming: true }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doubtId: activeDoubtId ?? "",
          documentId,
          pageNumber: currentPage,
          courseName,
          lectureTitle,
          userMessage: text,
        }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accContent = "";

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

          // First event carries the doubtId
          if (parsed.doubtId && !activeDoubtId) {
            setActiveDoubtId(parsed.doubtId);
            // Notify parent about new doubt
            supabase
              .from("doubts")
              .select("*")
              .eq("id", parsed.doubtId)
              .single()
              .then(({ data }) => { if (data) onDoubtCreated(data); });
          }

          if (parsed.chunk) {
            accContent += parsed.chunk;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstMsgId ? { ...m, content: accContent } : m
              )
            );
          }
        }
      }

      // Mark streaming done
      setMessages((prev) =>
        prev.map((m) => (m.id === asstMsgId ? { ...m, streaming: false } : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response");
      setMessages((prev) => prev.filter((m) => m.id !== asstMsgId));
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  // Save an AI message as a note pinned to the current page
  async function saveAsNote(messageContent: string, messageId: string) {
    setSavingNote(messageId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: note, error: noteErr } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          course_id: courseId,
          document_id: documentId,
          page_number: currentPage,
          content_md: messageContent,
          source: "ai",
          tags: [],
        })
        .select()
        .single();

      if (noteErr || !note) throw new Error(noteErr?.message ?? "Failed to save note");
      onSaveNote(note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note");
    } finally {
      setSavingNote(null);
    }
  }

  // Convert entire thread to a structured note
  async function convertDoubtToNote() {
    if (!activeDoubtId) return;
    setConvertingDoubt(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/doubt-to-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doubtId: activeDoubtId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: note, error: noteErr } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          course_id: courseId,
          document_id: documentId,
          page_number: currentPage,
          content_md: body.note,
          source: "doubt",
          tags: [],
        })
        .select()
        .single();

      if (noteErr || !note) throw new Error(noteErr?.message ?? "Failed to save note");
      onSaveNote(note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert");
    } finally {
      setConvertingDoubt(false);
    }
  }

  function startNewDoubt() {
    setActiveDoubtId(null);
    setMessages([]);
    setShowDoubts(false);
    setError(null);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Doubts dropdown header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 flex-shrink-0">
        <button
          onClick={() => setShowDoubts(!showDoubts)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          aria-expanded={showDoubts}
          aria-label="Toggle doubts list"
        >
          <span className="font-medium">
            {activeDoubtId
              ? doubts.find((d) => d.id === activeDoubtId)?.title ?? "Current doubt"
              : "New doubt"}
          </span>
          <ChevronDown
            className={`h-3 w-3 transition-transform ${showDoubts ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        <button onClick={startNewDoubt} className="btn-ghost text-xs py-1 px-2">
          <Plus className="h-3 w-3" aria-hidden="true" /> New
        </button>
      </div>

      {/* Doubts dropdown */}
      {showDoubts && doubts.length > 0 && (
        <div className="border-b border-slate-100 bg-slate-50 max-h-40 overflow-y-auto flex-shrink-0">
          {doubts.map((d) => (
            <button
              key={d.id}
              onClick={() => { setActiveDoubtId(d.id); setShowDoubts(false); setMessages([]); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-100 transition-colors flex items-center gap-2 ${activeDoubtId === d.id ? "bg-brand-50 text-brand-700" : "text-slate-700"}`}
            >
              {d.status === "resolved"
                ? <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" aria-hidden="true" />
                : <AlertCircle className="h-3 w-3 text-amber-400 flex-shrink-0" aria-hidden="true" />
              }
              <span className="truncate">{d.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <FileText className="h-8 w-8 text-slate-200 mx-auto mb-2" aria-hidden="true" />
              <p className="text-xs text-slate-400">
                Ask a question about slide {currentPage}
              </p>
              <p className="text-xs text-slate-300 mt-1">Shift+Enter for new line</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onSaveNote={saveAsNote}
            isSaving={savingNote === msg.id}
          />
        ))}

        {error && (
          <div role="alert" className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Convert whole thread to note button */}
      {messages.some((m) => m.role === "assistant" && !m.streaming) && activeDoubtId && (
        <div className="px-3 py-1.5 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={convertDoubtToNote}
            disabled={convertingDoubt}
            className="w-full btn-secondary text-xs py-1.5 justify-center"
          >
            {convertingDoubt
              ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              : <BookmarkPlus className="h-3 w-3" aria-hidden="true" />
            }
            Summarise this doubt into a note
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={sendMessage} className="border-t border-slate-200 p-3 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this slide…"
            rows={2}
            className="flex-1 resize-none input text-sm py-2 min-h-[2.5rem] max-h-32"
            aria-label="Message input"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="btn-primary py-2 px-3 flex-shrink-0"
            aria-label="Send message"
          >
            {sending
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <Send className="h-4 w-4" aria-hidden="true" />
            }
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({
  message,
  onSaveNote,
  isSaving,
}: {
  message: LocalMessage;
  onSaveNote: (content: string, id: string) => void;
  isSaving: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`group flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
          isUser
            ? "bg-brand-500 text-white rounded-br-sm"
            : "bg-slate-100 text-slate-800 rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div>
            <MarkdownRenderer content={message.content} />
            {message.streaming && (
              <span className="inline-block w-1 h-3 bg-slate-400 animate-pulse rounded-sm ml-0.5" aria-label="Streaming" />
            )}
          </div>
        )}
      </div>

      {/* Save to note button (only for completed assistant messages) */}
      {!isUser && !message.streaming && message.content && (
        <button
          onClick={() => onSaveNote(message.content, message.id)}
          disabled={isSaving}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-slate-400 hover:text-brand-600 px-1"
          aria-label="Save as note"
        >
          {isSaving
            ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            : <BookmarkPlus className="h-3 w-3" aria-hidden="true" />
          }
          Save to note
        </button>
      )}
    </div>
  );
}
