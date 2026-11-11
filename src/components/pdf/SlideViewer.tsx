"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Point react-pdf at the pdfjs worker bundled with the package
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  pdfUrl: string;
  pageCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function SlideViewer({ pdfUrl, pageCount, currentPage, onPageChange }: Props) {
  const [zoomIdx, setZoomIdx] = useState(2); // default 1×
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const zoom = ZOOM_LEVELS[zoomIdx];

  const goTo = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, pageCount));
      onPageChange(clamped);
    },
    [pageCount, onPageChange]
  );

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't steal keys from inputs / textareas
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goTo(currentPage + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goTo(currentPage - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentPage, goTo]);

  function zoomIn() {
    setZoomIdx((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1));
  }
  function zoomOut() {
    setZoomIdx((i) => Math.max(i - 1, 0));
  }
  function resetZoom() {
    setZoomIdx(2);
  }

  // Compute page width based on container and zoom
  const containerWidth = containerRef.current?.clientWidth ?? 800;
  const pageWidth = Math.floor((containerWidth - 48) * zoom);

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white border-b border-slate-100">
        {/* Page nav */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage <= 1}
            className="btn-ghost p-1.5"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const val = parseInt(
                (e.currentTarget.elements.namedItem("page") as HTMLInputElement).value
              );
              if (!isNaN(val)) goTo(val);
            }}
            className="flex items-center gap-1"
          >
            <input
              name="page"
              type="number"
              min={1}
              max={pageCount}
              defaultValue={currentPage}
              key={currentPage} // reset when page changes externally
              className="w-12 text-center input py-0.5 text-sm"
              aria-label="Page number"
            />
            <span className="text-xs text-slate-400">/ {pageCount}</span>
          </form>

          <button
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage >= pageCount}
            className="btn-ghost p-1.5"
            aria-label="Next slide"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} disabled={zoomIdx === 0} className="btn-ghost p-1.5" aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </button>
          <button onClick={resetZoom} className="btn-ghost px-2 py-1 text-xs tabular-nums" aria-label="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={zoomIn} disabled={zoomIdx === ZOOM_LEVELS.length - 1} className="btn-ghost p-1.5" aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* PDF canvas area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex justify-center py-6 bg-slate-200"
      >
        <Document
          file={pdfUrl}
          onLoadSuccess={() => setLoaded(true)}
          onLoadError={(err) => console.error("PDF load error", err)}
          loading={
            <div className="flex items-center justify-center h-64 w-full">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" aria-label="Loading PDF" role="status" />
            </div>
          }
          error={
            <div className="p-8 text-red-600 text-sm">
              Failed to load PDF. Check the URL or try reloading.
            </div>
          }
        >
          {loaded && (
            <Page
              pageNumber={currentPage}
              width={pageWidth}
              renderTextLayer
              renderAnnotationLayer
              className="shadow-xl rounded-sm"
            />
          )}
        </Document>
      </div>
    </div>
  );
}
