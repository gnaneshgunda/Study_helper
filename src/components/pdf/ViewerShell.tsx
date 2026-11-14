"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, FileText, PanelRightClose, PanelRightOpen, Maximize2, Minimize2 } from "lucide-react";
import { SlideViewer } from "@/components/pdf/SlideViewer";
import { SidePanel } from "@/components/chat/SidePanel";

type PanelState = "collapsed" | "normal" | "wide";

const PANEL_WIDTHS: Record<PanelState, string> = {
  collapsed: "0px",
  normal: "400px",
  wide: "580px",
};

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
  const [panelState, setPanelState] = useState<PanelState>("normal");

  const handlePageChange = useCallback((page: number) => setCurrentPage(page), []);

  function cyclePanel() {
    setPanelState((prev) => {
      if (prev === "collapsed") return "normal";
      if (prev === "normal") return "wide";
      return "collapsed";
    });
  }

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

        {/* Panel toggle in header */}
        <button
          onClick={cyclePanel}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 transition-all flex-shrink-0"
          aria-label={
            panelState === "collapsed" ? "Show side panel"
            : panelState === "normal" ? "Expand side panel"
            : "Collapse side panel"
          }
          title={
            panelState === "collapsed" ? "Show panel"
            : panelState === "normal" ? "Widen panel"
            : "Hide panel"
          }
        >
          {panelState === "collapsed" && <PanelRightOpen className="h-5 w-5" />}
          {panelState === "normal" && <Maximize2 className="h-4 w-4" />}
          {panelState === "wide" && <PanelRightClose className="h-5 w-5" />}
        </button>
      </header>

      {/* Two-pane body */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Left: PDF */}
        <div className="flex-1 min-w-0 overflow-hidden transition-all duration-300">
          <SlideViewer
            pdfUrl={pdfUrl}
            pageCount={pageCount}
            currentPage={currentPage}
            onPageChange={handlePageChange}
          />
        </div>

        {/* Divider bar — only when panel is visible */}
        {panelState !== "collapsed" && (
          <div className="w-1 bg-stone-200/50 hover:bg-brand-300 cursor-pointer transition-colors flex-shrink-0 relative group"
            onClick={cyclePanel}
            role="separator"
            aria-label="Resize panel — click to cycle"
          >
            {/* Center toggle button */}
            <button
              onClick={(e) => { e.stopPropagation(); cyclePanel(); }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white border border-stone-200 shadow-sm hover:shadow-md hover:border-brand-300 transition-all"
              aria-label={panelState === "wide" ? "Shrink panel" : "Widen panel"}
            >
              {panelState === "wide"
                ? <Minimize2 className="h-3.5 w-3.5 text-stone-500" />
                : <Maximize2 className="h-3.5 w-3.5 text-stone-500" />
              }
            </button>
          </div>
        )}

        {/* Right: side panel — animated width */}
        <div
          className="flex-shrink-0 bg-white flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out"
          style={{ width: PANEL_WIDTHS[panelState] }}
        >
          {/* Always render the panel content so state survives collapse */}
          <div className="w-[580px] h-full flex flex-col">
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

        {/* Floating expand button when collapsed */}
        {panelState === "collapsed" && (
          <button
            onClick={cyclePanel}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex h-12 w-7 items-center justify-center rounded-l-xl bg-white border border-r-0 border-stone-200 shadow-md hover:bg-stone-50 hover:w-8 transition-all"
            aria-label="Show side panel"
          >
            <PanelRightOpen className="h-4 w-4 text-stone-500" />
          </button>
        )}
      </div>
    </div>
  );
}
