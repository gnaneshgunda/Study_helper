"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface Props {
  pdfUrl: string;
  pageCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const PAGE_GAP = 24;

export function SlideViewer({ pdfUrl, pageCount, currentPage, onPageChange }: Props) {
  const [zoomIdx, setZoomIdx] = useState(2);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const programmaticScroll = useRef(false);

  const zoom = ZOOM_LEVELS[zoomIdx];
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setContainerWidth(entries[0].contentRect.width));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const pageWidth = Math.max(300, Math.floor((containerWidth - 64) * zoom));

  // IntersectionObserver
  useEffect(() => {
    if (!loaded) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (programmaticScroll.current) return;
        let best = { ratio: 0, page: currentPage };
        entries.forEach((entry) => {
          const page = Number((entry.target as HTMLElement).dataset.page);
          if (entry.intersectionRatio > best.ratio) best = { ratio: entry.intersectionRatio, page };
        });
        if (best.ratio > 0) onPageChange(best.page);
      },
      { root: containerRef.current, threshold: Array.from({ length: 11 }, (_, i) => i / 10) }
    );
    pageRefs.current.forEach((el) => { if (el) observerRef.current!.observe(el); });
    return () => observerRef.current?.disconnect();
  }, [loaded, pageCount, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* ── Toolbar ── big slide number, warm styling */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-white border-b border-stone-200/70">
        {/* Page nav — big visible slide number */}
        <div className="flex items-center gap-3">
          <button onClick={() => goTo(currentPage - 1)} disabled={currentPage <= 1}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 hover:bg-brand-50 hover:text-brand-600 text-stone-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous page">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* The slide number itself — big and readable */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums text-slate-900">{currentPage}</span>
            <span className="text-sm font-medium text-stone-300">/ {pageCount}</span>
          </div>

          <button onClick={() => goTo(currentPage + 1)} disabled={currentPage >= pageCount}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 hover:bg-brand-50 hover:text-brand-600 text-stone-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next page">
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Zoom — subtle */}
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} disabled={zoomIdx === 0}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-all disabled:opacity-30"
            aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </button>
          <button onClick={resetZoom} className="text-xs font-medium text-stone-500 hover:text-stone-800 px-2 tabular-nums transition-colors"
            aria-label="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={zoomIn} disabled={zoomIdx === ZOOM_LEVELS.length - 1}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-all disabled:opacity-30"
            aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Scrollable PDF area — warm background ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-auto"
        style={{ backgroundColor: "#f0eeea" }}
      >
        <Document
          file={pdfUrl}
          onLoadSuccess={() => setLoaded(true)}
          onLoadError={(err) => console.error("PDF load error", err)}
          loading={
            <div className="flex items-center justify-center h-64">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" role="status" aria-label="Loading" />
            </div>
          }
          error={
            <div className="p-12 text-center">
              <p className="text-stone-400 text-sm">Failed to load PDF. Try reloading.</p>
            </div>
          }
        >
          {loaded && Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
            <div
              key={pageNum}
              ref={(el) => { pageRefs.current[pageNum - 1] = el; }}
              data-page={pageNum}
              className="flex justify-center relative"
              style={{ paddingTop: pageNum === 1 ? PAGE_GAP : 0, paddingBottom: PAGE_GAP }}
            >
              {/* Slide number label floating above each page */}
              <div className={`absolute top-1 left-1/2 -translate-x-1/2 z-10 px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums transition-all ${currentPage === pageNum ? "bg-brand-500 text-white shadow-md" : "bg-white/70 text-stone-400"}`}>
                {pageNum}
              </div>
              <div className={`rounded-lg transition-all duration-200 ${currentPage === pageNum ? "ring-2 ring-brand-400 shadow-2xl" : "shadow-lg"}`}>
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
