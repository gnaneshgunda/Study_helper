"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { type Course, type Lecture, type Document } from "@/types/database";
import { Plus, FileText, Loader2, X, ChevronLeft, Upload } from "lucide-react";
import { AppShell } from "@/components/ui/AppShell";
import { UploadModal } from "@/components/courses/UploadModal";

type LectureWithDocs = Lecture & { documents: Pick<Document, "id" | "title" | "page_count">[] };

interface Props {
  course: Course;
  initialLectures: LectureWithDocs[];
}

export function CourseDetailClient({ course, initialLectures }: Props) {
  const supabase = createClient();
  const [lectures, setLectures] = useState<LectureWithDocs[]>(initialLectures);
  const [showLectureModal, setShowLectureModal] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<LectureWithDocs | null>(null);
  const [lectureTitle, setLectureTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createLecture(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const nextPos = lectures.length > 0 ? Math.max(...lectures.map((l) => l.position)) + 1 : 0;

    const { data, error: err } = await supabase
      .from("lectures")
      .insert({ course_id: course.id, title: lectureTitle, position: nextPos })
      .select()
      .single();

    if (err) {
      setError(err.message);
    } else if (data) {
      setLectures([...lectures, { ...data, documents: [] }]);
      setShowLectureModal(false);
      setLectureTitle("");
    }
    setLoading(false);
  }

  function handleUploadComplete(lectureId: string, doc: Pick<Document, "id" | "title" | "page_count">) {
    setLectures(lectures.map((l) =>
      l.id === lectureId ? { ...l, documents: [...l.documents, doc] } : l
    ));
    setUploadTarget(null);
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb + header */}
        <div className="mb-6">
          <Link href="/courses" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors mb-3">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> All courses
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: course.color }}
                aria-hidden="true"
              />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{course.name}</h1>
                {(course.code || course.semester) && (
                  <p className="text-sm text-slate-400 mt-0.5">
                    {[course.code, course.semester].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
            <button onClick={() => setShowLectureModal(true)} className="btn-primary flex-shrink-0">
              <Plus className="h-4 w-4" aria-hidden="true" /> Add lecture
            </button>
          </div>
        </div>

        {/* Lectures */}
        {lectures.length === 0 ? (
          <div className="text-center py-24">
            <FileText className="h-12 w-12 text-slate-200 mx-auto mb-3" aria-hidden="true" />
            <p className="text-slate-500 mb-4">No lectures yet.</p>
            <button onClick={() => setShowLectureModal(true)} className="btn-secondary">
              <Plus className="h-4 w-4" aria-hidden="true" /> Add first lecture
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {lectures.map((lecture, idx) => (
              <div key={lecture.id} className="card p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-300 w-6 text-right">{idx + 1}</span>
                    <h2 className="font-medium text-slate-900">{lecture.title}</h2>
                  </div>
                  <button
                    onClick={() => setUploadTarget(lecture)}
                    className="btn-ghost text-xs flex-shrink-0"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" /> Upload PDF
                  </button>
                </div>

                {lecture.documents.length > 0 && (
                  <ul className="mt-3 ml-9 space-y-1" aria-label="Documents in this lecture">
                    {lecture.documents.map((doc) => (
                      <li key={doc.id}>
                        <Link
                          href={`/courses/${course.id}/lectures/${lecture.id}/documents/${doc.id}`}
                          className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          {doc.title}
                          <span className="text-slate-300 text-xs">{doc.page_count}p</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add lecture modal */}
      {showLectureModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lecture-modal-title"
        >
          <div className="card w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 id="lecture-modal-title" className="text-lg font-semibold">Add lecture</h2>
              <button onClick={() => setShowLectureModal(false)} className="btn-ghost p-1" aria-label="Close">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={createLecture} className="space-y-4">
              <div>
                <label htmlFor="lecture-title" className="label">Title *</label>
                <input
                  id="lecture-title"
                  required
                  value={lectureTitle}
                  onChange={(e) => setLectureTitle(e.target.value)}
                  className="input"
                  placeholder="e.g. Lecture 3: Matrix Operations"
                  autoFocus
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowLectureModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload PDF modal */}
      {uploadTarget && (
        <UploadModal
          courseId={course.id}
          lecture={uploadTarget}
          onClose={() => setUploadTarget(null)}
          onComplete={(doc) => handleUploadComplete(uploadTarget.id, doc)}
        />
      )}
    </AppShell>
  );
}
