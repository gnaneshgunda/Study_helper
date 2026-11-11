import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CourseNotesClient } from "@/components/notes/CourseNotesClient";

interface Props {
  params: Promise<{ courseId: string }>;
}

export default async function CourseNotesPage({ params }: Props) {
  const { courseId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();
  if (!course) notFound();

  // All notes for this course, with document and lecture info
  const { data: notes } = await supabase
    .from("notes")
    .select(`
      *,
      documents (
        id, title,
        lectures ( id, title, position )
      )
    `)
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  // Revision note (special note tagged "revision")
  const { data: revisionNote } = await supabase
    .from("notes")
    .select("*")
    .eq("course_id", courseId)
    .contains("tags", ["revision"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <CourseNotesClient
      course={course}
      initialNotes={notes ?? []}
      initialRevisionNote={revisionNote ?? null}
    />
  );
}
