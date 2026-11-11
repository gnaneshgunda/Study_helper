import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ViewerShell } from "@/components/pdf/ViewerShell";

interface Props {
  params: Promise<{
    courseId: string;
    lectureId: string;
    documentId: string;
  }>;
}

export default async function DocumentViewerPage({ params }: Props) {
  const { courseId, lectureId, documentId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Fetch document, lecture and course in one go
  const { data: doc } = await supabase
    .from("documents")
    .select(`
      *,
      lectures (
        id, title, course_id,
        courses ( id, name, color )
      )
    `)
    .eq("id", documentId)
    .single();

  if (!doc) notFound();

  // Get a signed URL (private bucket)
  const { data: signedData } = await supabase.storage
    .from("slides")
    .createSignedUrl(doc.storage_path, 3600); // 1 hour

  if (!signedData?.signedUrl) {
    return <p className="p-8 text-red-600">Could not load PDF. Storage error.</p>;
  }

  const lecture = doc.lectures as {
    id: string; title: string; course_id: string;
    courses: { id: string; name: string; color: string };
  };

  return (
    <ViewerShell
      documentId={documentId}
      courseId={courseId}
      lectureId={lectureId}
      pdfUrl={signedData.signedUrl}
      pageCount={doc.page_count}
      documentTitle={doc.title}
      lectureTitle={lecture.title}
      courseName={lecture.courses.name}
      courseColor={lecture.courses.color}
    />
  );
}
