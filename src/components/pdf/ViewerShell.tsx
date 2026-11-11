"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SlideViewer } from "@/components/pdf/SlideViewer";
import { SidePanel } from "@/components/chat/SidePanel";

interface Props {
  documentId: string;
  courseId: string;
  lectureId: string;
  pdfUrl: string;
  pageCount: number;
  documentTitle: string;
  lectureTitle: string;
  courseName: string;
  courseColor: string;
}

export function ViewerShell({
  documentId,
  courseId,
  lectureId,
  pdfUrl,
  pageCount,
  documentTitle,
  lectureTitle,
  courseName,
  courseColor,
}: Props) {
  const [currentPage, setCurrentPage] = useState(1);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* Slim top bar */}
      <header className="flex-shrink-0 h-12 bg-white border-b border-slate-200 flex items-center px-4 gap-3 z-30">
        <Link
          href={`/courses/${courseId}`}
          className="btn-ghost p-1.5"
          aria-label="Back to course"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <div
          className="h-5 w-1 rounded-full flex-shrink-0"
          style={{ backgroundColor: courseColor }}
          aria-hidden="true"
        />
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-medium text-slate-900 truncate">{documentTitle}</span>
          <span className="text-xs text-slate-400 flex-shrink-0 hidden sm:inline">
            {lectureTitle} · {courseName}
          </span>
        </div>
        <span className="ml-auto text-xs text-slate-400 flex-shrink-0">
          {currentPage} / {pageCount}
        </span>
      </header>

      {/* Two-pane body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: PDF */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <SlideViewer
            pdfUrl={pdfUrl}
            pageCount={pageCount}
            currentPage={currentPage}
            onPageChange={handlePageChange}
          />
        </div>

        {/* Right: side panel (chat + notes) */}
        <div className="w-96 flex-shrink-0 border-l border-slate-200 bg-white flex flex-col min-h-0 hidden md:flex">
          <SidePanel
            documentId={documentId}
            courseId={courseId}
            currentPage={currentPage}
            lectureTitle={lectureTitle}
            courseName={courseName}
          />
        </div>
      </div>
    </div>
  );
}
