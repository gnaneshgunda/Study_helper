"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, FileText, PanelRight, PanelRightClose } from "lucide-react";
import { SlideViewer } from "@/components/pdf/SlideViewer";
import { SidePanel } from "@/components/chat/SidePanel";

const MIN_WIDTH = 300;
const MAX_WIDTH = 900;

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
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(400);
  const [isDragging, setIsDragging] = useState(false);

  // Refs for drag tracking (avoid re-renders during drag)
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handlePageChange = useCallback((page: number) => setCurrentPage(page), []);

  // ── Drag resize logic ──────────────────────────────────────────────────
  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;
    setIsDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      // Moving cursor left = wider panel, right = narrower
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidthRef.current + delta));
      setPanelWidth(newWidth);
    }

    function handleMouseUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "#f0eeea" }}>
      {/* Top bar */}
      <header className="flex-shrink-0 h-14 bg-white/95 backdrop-blur border-b border-stone-200/70 flex items-center px-5 gap-3 z-30">
        <Link href={`/courses/${courseId}`} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-all" aria-label="Back to course">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Link>

        <div className="h-6 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: courseColor }} aria-hidden="true" />

        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-stone-300 flex-shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-800 truncate">{documentTitle}</span>
          <span className="text-xs text-stone-400 flex-shrink-0 hidden lg:inline">· {lectureTitle}</span>
        </div>

        {/* Slide counter */}
        <div className="ml-auto flex items-center gap-1.5 bg-stone-50 rounded-full px-3 py-1 flex-shrink-0">
          <span className="text-sm font-bold tabular-nums text-slate-800">{currentPage}</span>
          <span className="text-xs text-stone-300">/</span>
          <span className="text-xs text-stone-400 tabular-nums">{pageCount}</span>
          <span className="text-xs text-stone-400 ml-0.5">slides</span>
        </div>

        {/* Toggle panel visibility */}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 transition-all flex-shrink-0"
          aria-label={panelOpen ? "Hide side panel" : "Show side panel"}
          title={panelOpen ? "Hide panel" : "Show panel"}
        >
          {panelOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRight className="h-5 w-5" />}
        </button>
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

        {/* Right: side panel with drag handle */}
        {panelOpen && (
          <>
            {/* Drag handle — thin bar on the left edge */}
            <div
              onMouseDown={handleMouseDown}
              className={`group/drag flex-shrink-0 w-1 bg-stone-200/60 hover:bg-brand-400 cursor-col-resize relative transition-colors ${
                isDragging ? "bg-brand-400" : ""
              }`}
              role="separator"
              aria-orientation="vertical"
              aria-label="Drag to resize panel"
            >
              {/* Visible grip dots on hover */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`w-1 h-1 rounded-full transition-all ${
                      isDragging
                        ? "bg-brand-600"
                        : "bg-stone-300 group-hover/drag:bg-brand-400"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Panel itself */}
            <div
              className="flex-shrink-0 bg-white flex flex-col min-h-0 overflow-hidden"
              style={{ width: `${panelWidth}px` }}
            >
              <SidePanel
                documentId={documentId}
                courseId={courseId}
                currentPage={currentPage}
                pageCount={pageCount}
                lectureTitle={lectureTitle}
                courseName={courseName}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
