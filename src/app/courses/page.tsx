import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CoursesClient } from "@/components/courses/CoursesClient";

export default async function CoursesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });

  return <CoursesClient initialCourses={courses ?? []} />;
}
