"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Note } from "@/types/database";
import {
  Eye,
  Code2,
  Wand2,
  Loader2,
  Check,
  X,
  Save,
  Tag,
  Plus,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

type EditorView = "edit" | "preview" | "split";

interface Props {
  /** Existing note — omit for new note */
  note?: Note;
  documentId: string;
  courseId: string;
  pageNumber: number;
  source: Note["source"];
  /** Initial content (e.g. from "Save to note" in chat) */
  initialContent?: string;
  onSaved: (note: Note) => void;
  onCancel: () => void;
}

const AUTOSAVE_MS = 1200;

export function NoteEditor({
  note,
  documentId,
  courseId,
  pageNumber,
  source,
  initialContent = "",
  onSaved,
  onCancel,
}: Props) {
  const supabase = createClient();

  const [content, setContent] = useState(note?.content_md ?? initialContent);
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [view, setView] = useState<EditorView>("split");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [dirtyContent, setDirtyContent] = useState<string | null>(null); // unsaved content guard

  // Format with AI
  const [formatting, setFormatting] = useState(false);
  const [formatPreview, setFormatPreview] = useState<string | null>(null); // diff preview
  const [formatError, setFormatError] = useState<string | null>(null);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Guard against navigating away with unsaved content
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyContent !== null) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyContent]);

  // ── Autosave ───────────────────────────────────────────────────────────────
  const persistNote = useCallback(
    async (md: string, noteTags: string[]) => {
      setSaving(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        if (note) {
          // Update existing
          const { data: updated, error } = await supabase
            .from("notes")
            .update({ content_md: md, tags: noteTags })
            .eq("id", note.id)
            .select()
            .single();
          if (!error && updated) {
            setDirtyContent(null);
            setSavedAt(new Date());
            onSaved(updated);
          }
        } else {
          // Insert new
          const { data: created, error } = await supabase
            .from("notes")
            .insert({
              user_id: user.id,
              course_id: courseId,
              document_id: documentId,
              page_number: pageNumber,
              content_md: md,
              source,
              tags: noteTags,
            })
            .select()
            .single();
          if (!error && created) {
            setDirtyContent(null);
            setSavedAt(new Date());
            onSaved(created);
          }
        }
      } finally {
        setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [note?.id, courseId, documentId, pageNumber, source]
  );

  function scheduleAutosave(newContent: string, newTags: string[]) {
    setDirtyContent(newContent);
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      persistNote(newContent, newTags);
    }, AUTOSAVE_MS);
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    scheduleAutosave(e.target.value, tags);
  }

  // ── Tags ──────────────────────────────────────────────────────────────────
  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      const newTags = [...tags, t];
      setTags(newTags);
      scheduleAutosave(content, newTags);
    }
    setTagInput("");
  }

  function removeTag(t: string) {
    const newTags = tags.filter((x) => x !== t);
    setTags(newTags);
    scheduleAutosave(content, newTags);
  }

  // ── Format with AI ────────────────────────────────────────────────────────
  async function handleFormatWithAI() {
    if (!content.trim()) return;
    setFormatting(true);
    setFormatError(null);
    setFormatPreview(null);

    try {
      const res = await fetch("/api/ai/format-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setFormatPreview(body.formatted);
    } catch (err) {
      setFormatError(err instanceof Error ? err.message : "Format failed");
    } finally {
      setFormatting(false);
    }
  }

  function acceptFormat() {
    if (!formatPreview) return;
    setContent(formatPreview);
    scheduleAutosave(formatPreview, tags);
    setFormatPreview(null);
  }

  function rejectFormat() {
    setFormatPreview(null);
  }

  // ── Manual save ───────────────────────────────────────────────────────────
  async function handleManualSave() {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    await persistNote(content, tags);
  }

  // ── Tab key in textarea ───────────────────────────────────────────────────
  function handleTabKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = content.substring(0, start) + "  " + content.substring(end);
      setContent(newVal);
      scheduleAutosave(newVal, tags);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }

  const isNewNote = !note;

  return (
    <div className="flex flex-col bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
        {/* View toggle */}
        <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs mr-1">
          {(["edit", "split", "preview"] as EditorView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2 py-1 capitalize transition-colors ${
                view === v
                  ? "bg-brand-500 text-white"
                  : "bg-white text-slate-500 hover:bg-slate-50"
              }`}
              aria-pressed={view === v}
              title={`${v} mode`}
            >
              {v === "edit" ? <Code2 className="h-3.5 w-3.5" aria-hidden="true" /> :
               v === "preview" ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> :
               <span className="text-xs">⊞</span>}
            </button>
          ))}
        </div>

        {/* Format with AI */}
        <button
          onClick={handleFormatWithAI}
          disabled={formatting || !content.trim()}
          className="btn-ghost text-xs py-1 px-2 ml-auto"
          title="Format note with AI"
        >
          {formatting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            : <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
          }
          <span className="hidden sm:inline ml-1">Format</span>
        </button>

        {/* Save status */}
        <div className="text-xs text-slate-400 flex items-center gap-1 px-1">
          {saving ? (
            <><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Saving…</>
          ) : savedAt ? (
            <><Check className="h-3 w-3 text-green-500" aria-hidden="true" /> Saved</>
          ) : dirtyContent !== null ? (
            <span className="text-amber-500">Unsaved</span>
          ) : null}
        </div>

        {/* Cancel */}
        {isNewNote && (
          <button onClick={onCancel} className="btn-ghost p-1" aria-label="Cancel">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Format preview (diff-like) */}
      {formatPreview !== null && (
        <div className="border-b border-amber-200 bg-amber-50 p-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-amber-700">AI formatted result — accept or reject?</p>
            <div className="flex gap-1">
              <button
                onClick={acceptFormat}
                className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200 transition-colors"
                aria-label="Accept AI format"
              >
                <Check className="h-3 w-3" aria-hidden="true" /> Accept
              </button>
              <button
                onClick={rejectFormat}
                className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 transition-colors"
                aria-label="Reject AI format"
              >
                <X className="h-3 w-3" aria-hidden="true" /> Reject
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-amber-200 bg-white p-2">
            <MarkdownRenderer content={formatPreview} />
          </div>
        </div>
      )}

      {formatError && (
        <div role="alert" className="text-xs text-red-600 bg-red-50 px-3 py-1.5 border-b border-red-100 flex-shrink-0">
          {formatError}
        </div>
      )}

      {/* Editor body */}
      <div
        className={`flex min-h-0 ${view === "split" ? "divide-x divide-slate-100" : ""}`}
        style={{ height: "280px" }}
      >
        {/* Textarea */}
        {(view === "edit" || view === "split") && (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleTabKey}
            placeholder={`Write your note in Markdown…\nUse $...$ for inline math and $$...$$ for block math.`}
            className="flex-1 resize-none p-3 text-sm font-mono text-slate-800 bg-white focus:outline-none placeholder-slate-300 min-h-0"
            aria-label="Note content (Markdown)"
            spellCheck
          />
        )}

        {/* Preview pane */}
        {(view === "preview" || view === "split") && (
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {content.trim() ? (
              <MarkdownRenderer content={content} />
            ) : (
              <p className="text-xs text-slate-300 italic">Preview will appear here…</p>
            )}
          </div>
        )}
      </div>

      {/* Tags + save footer */}
      <div className="border-t border-slate-100 px-3 py-2 flex flex-col gap-2 flex-shrink-0 bg-slate-50">
        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Tag className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" aria-hidden="true" />
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-0.5 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700"
            >
              {t}
              <button
                onClick={() => removeTag(t)}
                className="hover:text-brand-900"
                aria-label={`Remove tag ${t}`}
              >
                <X className="h-2.5 w-2.5" aria-hidden="true" />
              </button>
            </span>
          ))}
          <form
            onSubmit={(e) => { e.preventDefault(); addTag(); }}
            className="flex items-center gap-1"
          >
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="add tag…"
              className="text-xs border-0 bg-transparent focus:outline-none text-slate-500 placeholder-slate-300 w-20"
              aria-label="Add tag"
            />
            {tagInput && (
              <button type="submit" className="text-brand-500 hover:text-brand-700" aria-label="Confirm tag">
                <Plus className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </form>
        </div>

        {/* Save/Cancel row */}
        <div className="flex items-center gap-2 justify-end">
          {isNewNote && (
            <button onClick={onCancel} className="btn-secondary text-xs py-1.5">
              Cancel
            </button>
          )}
          <button
            onClick={handleManualSave}
            disabled={saving || !content.trim()}
            className="btn-primary text-xs py-1.5"
          >
            {saving
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              : <Save className="h-3.5 w-3.5" aria-hidden="true" />
            }
            {isNewNote ? "Save note" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
