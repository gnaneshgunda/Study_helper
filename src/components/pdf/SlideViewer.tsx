"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker must match react-pdf's own bundled pdfjs version (4.4.168).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface Props {
  pdfUrl: string;
  pageCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2];
// Gap between pages in px
const PAGE_GAP = 16;

export function SlideViewer({ pdfUrl, pageCount, currentPage, onPageChange }: Props) {
  const [zoomIdx, setZoomIdx] = useState(2);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Track which page is in view via IntersectionObserver
  const observerRef = useRef<IntersectionObserver | null>(null);
  const programmaticScroll = useRef(false);

  const zoom = ZOOM_LEVELS[zoomIdx];
  const [containerWidth, setContainerWidth] = useState(800);

  // Track container width for responsive page sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const pageWidth = Math.max(300, Math.floor((containerWidth - 48) * zoom));

  // ── IntersectionObserver: update currentPage as user scrolls ──────────────
  useEffect(() => {
    if (!loaded) return;
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (programmaticScroll.current) return;
        // Pick the page with the highest intersection ratio
        let best = { ratio: 0, page: currentPage };
        entries.forEach((entry) => {
          const page = Number((entry.target as HTMLElement).dataset.page);
          if (entry.intersectionRatio > best.ratio) {
            best = { ratio: entry.intersectionRatio, page };
          }
        });
        if (best.ratio > 0) onPageChange(best.page);
      },
      { root: containerRef.current, threshold: Array.from({ length: 11 }, (_, i) => i / 10) }
    );

    pageRefs.current.forEach((el) => {
      if (el) observerRef.current!.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [loaded, pageCount, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll to page when currentPage changes externally ───────────────────
  const goTo = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, pageCount));
      onPageChange(clamped);
      const el = pageRefs.current[clamped - 1];
      if (el) {
        programmaticScroll.current = true;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => { programmaticScroll.current = false; }, 800);
      }
    },
    [pageCount, onPageChange]
  );

  // Scroll to page when parent changes currentPage (e.g. keyboard or page input)
  const prevPage = useRef(currentPage);
  useEffect(() => {
    if (prevPage.current !== currentPage) {
      prevPage.current = currentPage;
      const el = pageRefs.current[currentPage - 1];
      if (el) {
        programmaticScroll.current = true;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => { programmaticScroll.current = false; }, 800);
      }
    }
  }, [currentPage]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goTo(currentPage + 1); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); goTo(currentPage - 1); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentPage, goTo]);

  function zoomIn()    { setZoomIdx((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1)); }
  function zoomOut()   { setZoomIdx((i) => Math.max(i - 1, 0)); }
  function resetZoom() { setZoomIdx(2); }

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white border-b border-slate-100">
        {/* Page nav */}
        <div className="flex items-center gap-1">
          <button onClick={() => goTo(currentPage - 1)} disabled={currentPage <= 1}
            className="btn-ghost p-1.5" aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = parseInt((e.currentTarget.elements.namedItem("pg") as HTMLInputElement).value);
              if (!isNaN(v)) goTo(v);
            }}
            className="flex items-center gap-1"
          >
            <input name="pg" type="number" min={1} max={pageCount}
              value={currentPage}
              onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) goTo(v); }}
              className="w-12 text-center input py-0.5 text-sm"
              aria-label="Page number"
            />
            <span className="text-xs text-slate-400">/ {pageCount}</span>
          </form>
          <button onClick={() => goTo(currentPage + 1)} disabled={currentPage >= pageCount}
            className="btn-ghost p-1.5" aria-label="Next page">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Zoom */}
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

      {/* ── Scrollable PDF area ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-auto bg-slate-200"
        style={{ scrollBehavior: "auto" }}
      >
        <Document
          file={pdfUrl}
          onLoadSuccess={() => setLoaded(true)}
          onLoadError={(err) => console.error("PDF load error", err)}
          loading={
            <div className="flex items-center justify-center h-64">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" role="status" aria-label="Loading" />
            </div>
          }
          error={
            <div className="p-8 text-red-600 text-sm text-center">
              Failed to load PDF. Check the URL or try reloading.
            </div>
          }
        >
          {/* Render ALL pages stacked — user scrolls freely */}
          {loaded && Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
            <div
              key={pageNum}
              ref={(el) => { pageRefs.current[pageNum - 1] = el; }}
              data-page={pageNum}
              className="flex justify-center"
              style={{ paddingTop: pageNum === 1 ? PAGE_GAP : 0, paddingBottom: PAGE_GAP }}
            >
              <div className={`shadow-lg rounded-sm transition-all duration-200 ${currentPage === pageNum ? "ring-2 ring-brand-400" : ""}`}>
                <Page
                  pageNumber={pageNum}
                  width={pageWidth}
                  renderTextLayer
                  renderAnnotationLayer
                />
              </div>
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}
