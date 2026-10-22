
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
} from "lucide-react";

import "./document-preview-shell.css";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  contained?: boolean;
  html?: string;
  src?: string;
  sandbox?: string;
  title: string;
  creatorCount?: number;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  /** Attribute set by shortlist pagination engine when pages are ready. */
  paginationReadyAttr?: string;
  paginationReadyValue?: string;
};

const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.85, 1, 1.15, 1.25, 1.5] as const;
/** Cover/closing use `.cpage`; inner sheets also have `.page`. */
const PAGE_SELECTOR = ".cpage, .page, .invoice-page";

function documentPages(doc: Document): HTMLElement[] {
  const pages = Array.from(doc.querySelectorAll<HTMLElement>(PAGE_SELECTOR));
  return pages.length ? pages.filter(page => !page.parentElement?.closest(PAGE_SELECTOR)) : doc.body ? [doc.body] : [];
}

function nearestZoomIndex(zoom: number): number {
  let best = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  ZOOM_STEPS.forEach((step, index) => {
    const delta = Math.abs(step - zoom);
    if (delta < bestDelta) {
      best = index;
      bestDelta = delta;
    }
  });
  return best;
}

export function DocumentPreviewShell({
  html,
  src,
  sandbox,
  contained = true,
  title,
  creatorCount,
  toolbarLeft,
  toolbarRight,
  paginationReadyAttr = "data-sl-paginated",
  paginationReadyValue = "ready",
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  const zoomLabel = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);

  const collectPages = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const pages = documentPages(doc);
    setPageCount(pages.length);
    setActivePage((prev) => Math.min(Math.max(1, prev), Math.max(1, pages.length)));

    const thumbs: string[] = [];
    pages.forEach((page, index) => {
      const label =
        page.querySelector(".sec-title")?.textContent?.trim() ||
        page.querySelector(".sec-tick")?.textContent?.trim() ||
        page.querySelector(".sec-badge")?.textContent?.trim() ||
        page.querySelector(".kicker")?.textContent?.trim() ||
        page.querySelector(".lbl")?.textContent?.trim() ||
        page.querySelector("h1")?.textContent?.trim() ||
        `Page ${index + 1}`;
      thumbs.push(label.length > 28 ? `${label.slice(0, 27)}…` : label);
    });
    setThumbnails(thumbs);
    setReady(true);
  }, []);

  useEffect(() => {
    setReady(false);
    setPageCount(0);
    setActivePage(1);
    setThumbnails([]);
  }, [html, src]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let observer: MutationObserver | null = null;
    let pollTimer: number | null = null;
    let cancelled = false;

    const tryCollect = () => {
      if (cancelled) return;
      const doc = iframe.contentDocument;
      if (!doc) return;

      const attrReady =
        !paginationReadyAttr ||
        doc.documentElement.getAttribute(paginationReadyAttr) === paginationReadyValue ||
        doc.body?.getAttribute(paginationReadyAttr) === paginationReadyValue;

      const pages = documentPages(doc);
      if (pages.length > 0 && (attrReady || !doc.getElementById("sl-measure-root"))) {
        collectPages();
        return true;
      }
      return false;
    };

    const onLoad = () => {
      if (tryCollect()) return;
      const doc = iframe.contentDocument;
      if (doc) {
        observer = new MutationObserver(() => {
          if (tryCollect() && observer) {
            observer.disconnect();
            observer = null;
          }
        });
        observer.observe(doc.documentElement, {
          attributes: true,
          childList: true,
          subtree: true,
        });
      }
      pollTimer = window.setInterval(() => {
        if (tryCollect() && pollTimer != null) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
      }, 200);
      window.setTimeout(() => {
        if (pollTimer != null) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
        if (!cancelled) collectPages();
      }, 4000);
    };

    iframe.addEventListener("load", onLoad);
    // srcDoc may already be loaded
    if (iframe.contentDocument?.readyState === "complete") {
      onLoad();
    }

    return () => {
      cancelled = true;
      iframe.removeEventListener("load", onLoad);
      observer?.disconnect();
      if (pollTimer != null) window.clearInterval(pollTimer);
    };
  }, [html, src, collectPages, paginationReadyAttr, paginationReadyValue]);

  const scrollToPage = useCallback(
    (page: number) => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      const pages = documentPages(doc);
      const target = pages[page - 1];
      if (!target) return;
      // Scroll only the document frame; scrollIntoView also moves its parent page.
      const frame = iframeRef.current?.contentWindow;
      frame?.scrollTo({ top: target.getBoundingClientRect().top + frame.scrollY, behavior: "smooth" });
      setActivePage(page);
    },
    []
  );

  const applyZoom = useCallback((nextZoom: number) => {
    setZoom(nextZoom);
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    doc.body.style.zoom = String(nextZoom);
    // Theme only the live preview scrollbars; exported document styles stay intact.
    doc.documentElement.style.scrollbarColor = "rgba(255,255,255,.65) #0057ff";
    doc.body.style.scrollbarColor = "rgba(255,255,255,.65) #0057ff";
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyZoom(zoom);
  }, [ready, zoom, applyZoom]);

  useEffect(() => {
    if (!ready) return;
    const frame = iframeRef.current?.contentWindow;
    const doc = iframeRef.current?.contentDocument;
    if (!frame || !doc) return;
    let scheduled = 0;
    const trackPage = () => {
      if (scheduled) return;
      scheduled = window.requestAnimationFrame(() => {
        scheduled = 0;
        const pages = documentPages(doc);
        let current = 1;
        pages.forEach((page, index) => {
          if (page.getBoundingClientRect().top <= frame.innerHeight * 0.35) current = index + 1;
        });
        setActivePage(current);
      });
    };
    frame.addEventListener("scroll", trackPage, { passive: true });
    return () => { frame.removeEventListener("scroll", trackPage); window.cancelAnimationFrame(scheduled); };
  }, [ready, html, src]);

  function zoomIn() {
    const index = nearestZoomIndex(zoom);
    const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, index + 1)] ?? 1;
    applyZoom(next);
  }

  function zoomOut() {
    const index = nearestZoomIndex(zoom);
    const next = ZOOM_STEPS[Math.max(0, index - 1)] ?? 1;
    applyZoom(next);
  }

  function resetZoom() {
    applyZoom(1);
  }

  return (
    <div className={cn("flex flex-col", contained ? "h-full min-h-0 min-w-0 flex-1 overflow-hidden" : "min-h-[calc(100vh-8rem)] gap-3")}>
      <div className={cn("z-20 shrink-0 border-b border-border print:hidden", contained ? "quotation-preview-toolbar px-3 py-1.5" : "sticky top-0 -mx-4 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-8 md:px-8")}>
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-2">{toolbarLeft}</div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 hidden items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-[12px] font-medium text-muted-foreground sm:flex">
              {creatorCount != null && <><span>
                {creatorCount} creator{creatorCount === 1 ? "" : "s"}
              </span>
              <span className="text-border">|</span></>}
              <span>
                {pageCount || "—"} page{pageCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Previous page"
                disabled={activePage <= 1 || pageCount === 0}
                onClick={() => scrollToPage(activePage - 1)}
              >
                <ChevronLeftIcon className="size-3.5" />
              </Button>
              <span className="min-w-[4.5rem] text-center text-[12px] font-medium tabular-nums text-foreground">
                {pageCount > 0 ? `${activePage} / ${pageCount}` : "— / —"}
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Next page"
                disabled={activePage >= pageCount || pageCount === 0}
                onClick={() => scrollToPage(activePage + 1)}
              >
                <ChevronRightIcon className="size-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Zoom out"
                onClick={zoomOut}
                disabled={zoom <= ZOOM_STEPS[0]!}
              >
                <MinusIcon className="size-3.5" />
              </Button>
              <span className="min-w-[3.25rem] text-center text-[12px] font-medium tabular-nums">
                {zoomLabel}
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Zoom in"
                onClick={zoomIn}
                disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]!}
              >
                <PlusIcon className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Reset zoom"
                onClick={resetZoom}
              >
                <RotateCcwIcon className="size-3.5" />
              </Button>
            </div>
            {toolbarRight}
          </div>
        </div>
      </div>

      <div className={cn("grid min-h-0 min-w-0 flex-1", contained ? "document-preview-surround gap-0 overflow-hidden p-0 sm:grid-cols-[152px_minmax(0,1fr)]" : "gap-3 lg:grid-cols-[168px_minmax(0,1fr)]")}>
        <aside aria-label="Document pages" className={cn("document-preview-pages print:hidden hidden overflow-y-auto overscroll-contain rounded-lg border border-border bg-muted/15 p-1.5", contained ? "h-full min-h-0 sm:block" : "max-h-[calc(100vh-10rem)] lg:block")}>
          <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Pages
          </p>
          <div className="space-y-1.5">
            {thumbnails.length === 0 ? (
              <p className="px-1 py-4 text-[11px] text-muted-foreground">
                {ready ? "No pages detected" : "Preparing pages…"}
              </p>
            ) : (
              thumbnails.map((label, index) => {
                const page = index + 1;
                const active = page === activePage;
                return (
                  <button
                    key={`thumb-${page}`}
                    type="button"
                    onClick={() => scrollToPage(page)}
                    aria-current={active ? "page" : undefined}
                    title={`Page ${page}: ${label}`}
                    className={cn(
                      "flex w-full rounded-md border text-left transition-colors",
                      contained ? "items-center gap-2 px-1.5 py-1.5" : "flex-col gap-1 px-2 py-2",
                      active
                        ? "border-primary/40 bg-primary/8"
                        : "border-border/70 bg-background hover:bg-muted/40"
                    )}
                  >
                    <span
                      className={cn(
                        "flex shrink-0 items-center justify-center rounded border font-semibold tabular-nums",
                        contained ? "size-7 text-xs" : "h-16 text-[18px]",
                        active
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground"
                      )}
                    >
                      {page}
                    </span>
                    <span className="min-w-0 truncate text-[10.5px] font-medium text-muted-foreground">
                      {label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <iframe
          ref={iframeRef}
          title={title}
          srcDoc={html}
          src={src}
          sandbox={sandbox}
          className={cn("document-preview-frame w-full min-w-0 rounded-lg border border-border bg-card", contained ? "h-full min-h-0" : "min-h-[1200px]")}
        />
      </div>
    </div>
  );
}
