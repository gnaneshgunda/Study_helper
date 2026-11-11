import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CourseDetailClient } from "@/components/courses/CourseDetailClient";

interface Props {
  params: Promise<{ courseId: string }>;
}

export default async function CourseDetailPage({ params }: Props) {
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

  const { data: lectures } = await supabase
    .from("lectures")
    .select(`*, documents(id, title, page_count)`)
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  return (
    <CourseDetailClient
      course={course}
      initialLectures={lectures ?? []}
    />
  );
}
