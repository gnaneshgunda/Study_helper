"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";
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
  documentId, courseId, lectureId, pdfUrl, pageCount,
  documentTitle, lectureTitle, courseName, courseColor,
}: Props) {
  const [currentPage, setCurrentPage] = useState(1);

  const handlePageChange = useCallback((page: number) => setCurrentPage(page), []);

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "#f0eeea" }}>
      {/* Top bar — warm, spacious */}
      <header className="flex-shrink-0 h-14 bg-white/95 backdrop-blur border-b border-stone-200/70 flex items-center px-5 gap-3 z-30">
        <Link href={`/courses/${courseId}`} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-all" aria-label="Back to course">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Link>

        <div className="h-6 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: courseColor }} aria-hidden="true" />

        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-stone-300 flex-shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-800 truncate">{documentTitle}</span>
          <span className="text-xs text-stone-400 flex-shrink-0 hidden lg:inline">
            · {lectureTitle}
          </span>
        </div>

        {/* Big slide counter on the right */}
        <div className="ml-auto flex items-center gap-1.5 bg-stone-50 rounded-full px-3 py-1 flex-shrink-0">
          <span className="text-sm font-bold tabular-nums text-slate-800">{currentPage}</span>
          <span className="text-xs text-stone-300">/</span>
          <span className="text-xs text-stone-400 tabular-nums">{pageCount}</span>
          <span className="text-xs text-stone-400 ml-0.5">slides</span>
        </div>
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

        {/* Right: side panel */}
        <div className="w-[400px] flex-shrink-0 border-l border-stone-200/70 bg-white flex flex-col min-h-0 hidden lg:flex">
          <SidePanel
            documentId={documentId}
            courseId={courseId}
            currentPage={currentPage}
            pageCount={pageCount}
            lectureTitle={lectureTitle}
            courseName={courseName}
          />
        </div>
      </div>
    </div>
  );
}
