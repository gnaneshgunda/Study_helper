"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { type Course } from "@/types/database";
import { Plus, BookOpen, Loader2, X, GraduationCap } from "lucide-react";
import { AppShell } from "@/components/ui/AppShell";

const COLORS = [
  "#4f6bed", "#7c3aed", "#db2777", "#dc2626",
  "#d97706", "#16a34a", "#0891b2", "#475569",
];

interface Props {
  initialCourses: Course[];
}

export function CoursesClient({ initialCourses }: Props) {
  const supabase = createClient();
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", semester: "", color: COLORS[0] });
  const [error, setError] = useState<string | null>(null);

  async function createCourse(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not signed in"); setLoading(false); return; }

    const { data, error: err } = await supabase
      .from("courses")
      .insert({ ...form, user_id: user.id })
      .select()
      .single();

    if (err) {
      setError(err.message);
    } else if (data) {
      setCourses([data, ...courses]);
      setShowModal(false);
      setForm({ name: "", code: "", semester: "", color: COLORS[0] });
    }
    setLoading(false);
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Courses</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {courses.length} course{courses.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New course
          </button>
        </div>

        {/* Grid */}
        {courses.length === 0 ? (
          <div className="text-center py-24">
            <GraduationCap className="h-12 w-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-slate-500 font-medium">No courses yet</p>
            <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1">
              Create a course, upload your slides, and start asking doubts.
              The AI sees your slides and builds notes you can revisit anytime.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.id}`}
                className="card p-5 hover:shadow-md transition-shadow flex flex-col gap-3 group"
              >
                <div
                  className="h-2 w-12 rounded-full"
                  style={{ backgroundColor: c.color }}
                  aria-hidden="true"
                />
                <div>
                  <h2 className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                    {c.name}
                  </h2>
                  {(c.code || c.semester) && (
                    <p className="text-sm text-slate-400 mt-0.5">
                      {[c.code, c.semester].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-auto">
                  <BookOpen className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
                  <span className="text-xs text-slate-400">View lectures →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* New course modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 id="modal-title" className="text-lg font-semibold">New course</h2>
              <button
                onClick={() => setShowModal(false)}
                className="btn-ghost p-1"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={createCourse} className="space-y-4">
              <div>
                <label htmlFor="name" className="label">Course name *</label>
                <input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                  placeholder="e.g. Linear Algebra"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="code" className="label">Code</label>
                  <input
                    id="code"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="input"
                    placeholder="e.g. MA201"
                  />
                </div>
                <div>
                  <label htmlFor="semester" className="label">Semester</label>
                  <input
                    id="semester"
                    value={form.semester}
                    onChange={(e) => setForm({ ...form, semester: e.target.value })}
                    className="input"
                    placeholder="e.g. Fall 2026"
                  />
                </div>
              </div>

              {/* Colour picker */}
              <div>
                <span className="label">Colour</span>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setForm({ ...form, color: col })}
                      className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: col,
                        borderColor: form.color === col ? col : "transparent",
                        outline: form.color === col ? `2px solid ${col}` : "none",
                        outlineOffset: "2px",
                      }}
                      aria-label={`Select colour ${col}`}
                      aria-pressed={form.color === col}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
