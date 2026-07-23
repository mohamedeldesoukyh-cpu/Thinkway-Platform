"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CampaignStudioLayoutMode } from "../types/campaign-studio";

/** Scroll offset inside reference desktop main column (thinkway-campaign-studio_3.html). */
export const STUDIO_REF_SCROLL_OFFSET = 20;

/** Fallback scroll offset when chrome height is not yet measured (panel mode). */
export const STUDIO_SCROLL_CHROME_OFFSET = 52;

type StudioNavSection = {
  id: string;
  title: string;
};

export function studioSectionDomId(
  sectionId: string,
  variant: "default" | "ref" = "default"
): string {
  return variant === "ref" ? `sub-${sectionId}` : `studio-section-${sectionId}`;
}

function cssLengthToPx(length: string, element: HTMLElement): number {
  const trimmed = length.trim();
  if (!trimmed || trimmed === "0") return 0;
  if (trimmed.endsWith("px")) return parseFloat(trimmed);

  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.height = trimmed;
  element.appendChild(probe);
  const px = probe.getBoundingClientRect().height;
  probe.remove();
  return px;
}

function resolveChromeHeightPx(
  chrome: HTMLElement | null,
  context: HTMLElement
): number {
  if (chrome?.offsetHeight) return chrome.offsetHeight;

  const measured = getComputedStyle(context)
    .getPropertyValue("--studio-chrome-height")
    .trim();
  if (measured) return cssLengthToPx(measured, context);

  return cssLengthToPx("3.25rem", context);
}

/** Resolve scroll offset for scroll-spy and smooth scroll (panel vs chat embed). */
export function resolveStudioScrollOffsetPx(
  scrollRoot: HTMLElement | null,
  layoutMode: CampaignStudioLayoutMode,
  refMode = false
): number {
  if (refMode) return STUDIO_REF_SCROLL_OFFSET;
  if (!scrollRoot) return STUDIO_SCROLL_CHROME_OFFSET;

  const chrome = scrollRoot.querySelector<HTMLElement>("[data-studio-top-chrome]");

  if (layoutMode === "chat") {
    const shell = scrollRoot.querySelector<HTMLElement>(".studio-shell-chat");
    if (!shell) {
      return resolveChromeHeightPx(chrome, scrollRoot);
    }

    const styles = getComputedStyle(shell);
    const stickyTopRaw =
      styles.getPropertyValue("--studio-sticky-top").trim() ||
      styles.getPropertyValue("--studio-sticky-top-measured").trim() ||
      styles.getPropertyValue("--ai-topbar-measured-height").trim() ||
      "var(--ai-topbar-height, 3.25rem)";
    const stickyTopPx = cssLengthToPx(stickyTopRaw, shell);
    const chromeHeight = resolveChromeHeightPx(chrome, shell);

    return stickyTopPx + chromeHeight;
  }

  return resolveChromeHeightPx(chrome, scrollRoot);
}

/** Scroll-spy + smooth scroll for Campaign Studio section navigation. */
export function useStudioSectionNav(
  sections: StudioNavSection[],
  scrollRoot: HTMLElement | null,
  layoutMode: CampaignStudioLayoutMode = "panel",
  refMode = false
) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const activeIdRef = useRef(activeId);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if (!sections.length || !scrollRoot) return;

    let observer: IntersectionObserver | null = null;

    const connectObserver = () => {
      const offset = resolveStudioScrollOffsetPx(scrollRoot, layoutMode, refMode);
      const sectionIdPrefix = refMode ? "sub-" : "studio-section-";

      const elements = sections
        .map((s) => document.getElementById(studioSectionDomId(s.id, refMode ? "ref" : "default")))
        .filter((el): el is HTMLElement => el != null);

      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          const intersecting = entries.filter((entry) => entry.isIntersecting);
          if (!intersecting.length) return;

          let topmost = intersecting[0];
          for (const entry of intersecting) {
            if (entry.boundingClientRect.top < topmost.boundingClientRect.top) {
              topmost = entry;
            }
          }

          const nextId = topmost.target.id.replace(sectionIdPrefix, "");
          if (nextId !== activeIdRef.current) {
            setActiveId(nextId);
          }
        },
        {
          root: scrollRoot,
          rootMargin: `-${offset}px 0px -70% 0px`,
          threshold: 0,
        }
      );

      for (const el of elements) {
        observer.observe(el);
      }
    };

    connectObserver();

    let resizeRaf = 0;

    const chrome = scrollRoot.querySelector<HTMLElement>("[data-studio-top-chrome]");
    const shell = scrollRoot.querySelector<HTMLElement>(".studio-shell-chat");

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && (shell || chrome)
        ? new ResizeObserver(() => {
            if (resizeRaf) return;
            resizeRaf = requestAnimationFrame(() => {
              resizeRaf = 0;
              connectObserver();
            });
          })
        : null;

    if (shell) resizeObserver?.observe(shell);
    if (chrome) resizeObserver?.observe(chrome);

    const onResize = () => connectObserver();
    window.addEventListener("resize", onResize);

    return () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
      observer?.disconnect();
    };
  }, [sections, scrollRoot, layoutMode, refMode]);

  const scrollToSection = useCallback(
    (id: string) => {
      const root = scrollRoot;
      const target = document.getElementById(studioSectionDomId(id, refMode ? "ref" : "default"));
      if (!root || !target) return;

      const offset = resolveStudioScrollOffsetPx(root, layoutMode, refMode);
      const rootRect = root.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const nextScrollTop =
        root.scrollTop + targetRect.top - rootRect.top - offset;

      root.scrollTo({
        top: Math.max(0, nextScrollTop),
        behavior: "smooth",
      });
      setActiveId(id);
    },
    [scrollRoot, layoutMode, refMode]
  );

  const activeTitle =
    sections.find((s) => s.id === activeId)?.title ?? sections[0]?.title ?? "";

  return { activeId, activeTitle, scrollToSection };
}
