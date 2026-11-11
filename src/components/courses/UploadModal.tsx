"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Lecture, type Document } from "@/types/database";
import { Upload, X, Loader2, FileText, CheckCircle2 } from "lucide-react";

interface Props {
  courseId: string;
  lecture: Lecture;
  onClose: () => void;
  onComplete: (doc: Pick<Document, "id" | "title" | "page_count">) => void;
}

type UploadStage = "idle" | "uploading" | "extracting" | "done" | "error";

export function UploadModal({ courseId, lecture, onClose, onComplete }: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<UploadStage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setTitle(f.name.replace(/\.pdf$/i, ""));
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStage("uploading");
    setError(null);
    setProgress(0);

    try {
      // 1. Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 2. Upload to Supabase Storage
      const storagePath = `${user.id}/${courseId}/${lecture.id}/${Date.now()}_${file.name}`;
      const { error: storageErr } = await supabase.storage
        .from("slides")
        .upload(storagePath, file, { contentType: "application/pdf" });

      if (storageErr) throw storageErr;
      setProgress(40);

      // 3. Call the server-side extract route
      setStage("extracting");
      const res = await fetch("/api/upload/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath, lectureId: lecture.id, title }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Extraction failed");
      }

      const doc: Document = await res.json();
      setProgress(100);
      setStage("done");

      setTimeout(() => {
        onComplete({ id: doc.id, title: doc.title, page_count: doc.page_count });
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStage("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
    >
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 id="upload-modal-title" className="text-lg font-semibold">Upload PDF</h2>
          <button
            onClick={onClose}
            disabled={stage === "uploading" || stage === "extracting"}
            className="btn-ghost p-1"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-5">
          Adding to <span className="font-medium text-slate-700">{lecture.title}</span>
        </p>

        {stage === "done" ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" aria-hidden="true" />
            <p className="font-medium text-slate-900">Upload complete!</p>
          </div>
        ) : (
          <form onSubmit={handleUpload} className="space-y-4">
            {/* Drop zone */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-200 rounded-xl p-6 hover:border-brand-400 hover:bg-brand-50 transition-colors text-center"
              aria-label="Choose PDF file"
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-slate-700">
                  <FileText className="h-5 w-5 text-brand-500" aria-hidden="true" />
                  <span className="text-sm font-medium truncate max-w-xs">{file.name}</span>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm text-slate-500">Click to choose a PDF</p>
                  <p className="text-xs text-slate-400 mt-1">Max 50 MB</p>
                </div>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={handleFileChange}
              aria-label="PDF file input"
            />

            {file && (
              <div>
                <label htmlFor="doc-title" className="label">Document title</label>
                <input
                  id="doc-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  placeholder="Title for this document"
                />
              </div>
            )}

            {/* Progress bar */}
            {(stage === "uploading" || stage === "extracting") && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{stage === "uploading" ? "Uploading…" : "Extracting text…"}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={stage === "uploading" || stage === "extracting"}
                className="btn-secondary flex-1 justify-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!file || stage === "uploading" || stage === "extracting"}
                className="btn-primary flex-1 justify-center"
              >
                {(stage === "uploading" || stage === "extracting") && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Upload
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
