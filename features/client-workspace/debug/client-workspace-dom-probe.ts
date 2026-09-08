"use client";

/**
 * TEMPORARY Client Workspace DOM/lifecycle probe.
 * Enable ONLY with ?debugCw=1 in the URL (no localStorage sticky enable).
 * Logs stay in-page (console + window globals + on-screen panel). No network.
 * Remove after the blank-roster / dead-tabs / black-screen root cause is proven.
 */

export type CwDebugSnapshot = {
  at: string;
  event: string;
  viewport: { w: number; h: number; dpr: number };
  visibilityState: DocumentVisibilityState;
  bodyOverflow: string;
  bodyOverflowAttr: string;
  section?: string;
  sheetOpen?: boolean;
  viewportMode?: string;
  showDetail?: boolean;
  creatorsLen?: number;
  filteredLen?: number;
  portalMounted?: boolean;
  cardsInDom: number;
  clist: ElementProbe | null;
  firstCard: ElementProbe | null;
  firstCardMain: ElementProbe | null;
  detailNodes: ElementProbe[];
  loadingOverlays: ElementProbe[];
  hitAtFirstCard: HitProbe | null;
  hitAtTabRow: HitProbe | null;
  clipAncestors: AncestorProbe[];
  notes: string[];
};

export type ElementProbe = {
  tag: string;
  id: string;
  className: string;
  rect: Rect;
  display: string;
  visibility: string;
  opacity: string;
  position: string;
  zIndex: string;
  transform: string;
  overflow: string;
  overflowX: string;
  overflowY: string;
  contain: string;
  pointerEvents: string;
  inViewport: boolean;
  zeroSized: boolean;
};

export type AncestorProbe = ElementProbe & {
  role: string;
};

export type HitProbe = {
  x: number;
  y: number;
  top: string;
  stack: string[];
};

type Rect = { x: number; y: number; w: number; h: number; top: number; bottom: number };

const LOG_KEY = "__TW_CW_DEBUG_LOG__";
const SNAP_KEY = "__TW_CW_DEBUG_LAST__";
const PANEL_ID = "tw-cw-debug-panel";

/** Shared live fields updated by ClientWorkspaceApp / CreatorsWorkspace (no React coupling). */
export const cwDebugLiveState: {
  section?: string;
  sheetOpen?: boolean;
  viewportMode?: string;
  showDetail?: boolean;
  creatorsLen?: number;
  filteredLen?: number;
  portalMounted?: boolean;
  appMountId?: number;
} = {};

export function isClientWorkspaceDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("debugCw") === "1";
  } catch {
    return false;
  }
}

/** Path + query with secrets stripped — safe for local console/panel only. */
export function cwDebugSafePath(): string {
  try {
    const url = new URL(window.location.href);
    for (const key of ["sign", "token", "access_token", "refresh_token", "code"]) {
      if (url.searchParams.has(key)) url.searchParams.set(key, "[redacted]");
    }
    return url.pathname + url.search;
  } catch {
    return "(unparseable)";
  }
}

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, top: r.top, bottom: r.bottom };
}

function describe(el: Element): ElementProbe {
  const cs = window.getComputedStyle(el);
  const rect = rectOf(el);
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  return {
    tag: el.tagName.toLowerCase(),
    id: (el as HTMLElement).id || "",
    className: typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className : "",
    rect,
    display: cs.display,
    visibility: cs.visibility,
    opacity: cs.opacity,
    position: cs.position,
    zIndex: cs.zIndex,
    transform: cs.transform,
    overflow: cs.overflow,
    overflowX: cs.overflowX,
    overflowY: cs.overflowY,
    contain: cs.contain,
    pointerEvents: cs.pointerEvents,
    inViewport: rect.bottom > 0 && rect.top < vh && rect.w > 0 && rect.x < vw && rect.x + rect.w > 0,
    zeroSized: rect.w < 1 || rect.h < 1,
  };
}

function label(el: Element | null): string {
  if (!el || !(el instanceof Element)) return String(el);
  const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : "";
  const cls =
    typeof (el as HTMLElement).className === "string" && (el as HTMLElement).className.trim()
      ? `.${(el as HTMLElement).className.trim().split(/\s+/).slice(0, 4).join(".")}`
      : "";
  return `${el.tagName.toLowerCase()}${id}${cls}`;
}

function hitProbe(x: number, y: number): HitProbe {
  const panel = document.getElementById(PANEL_ID);
  const btn = document.getElementById(`${PANEL_ID}-btn`);
  const prevPanelVis = panel ? (panel as HTMLElement).style.visibility : "";
  const prevBtnVis = btn ? (btn as HTMLElement).style.visibility : "";
  try {
    if (panel) (panel as HTMLElement).style.visibility = "hidden";
    if (btn) (btn as HTMLElement).style.visibility = "hidden";
    const top = document.elementFromPoint(x, y);
    const stack =
      typeof document.elementsFromPoint === "function"
        ? document.elementsFromPoint(x, y).slice(0, 12).map(label)
        : [label(top)];
    return { x, y, top: label(top), stack };
  } finally {
    if (panel) (panel as HTMLElement).style.visibility = prevPanelVis;
    if (btn) (btn as HTMLElement).style.visibility = prevBtnVis;
  }
}

function walkClipAncestors(el: Element | null): AncestorProbe[] {
  const out: AncestorProbe[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && depth < 16) {
    const probe = describe(cur);
    const interesting =
      probe.overflow !== "visible" ||
      probe.overflowX !== "visible" ||
      probe.overflowY !== "visible" ||
      probe.position === "fixed" ||
      probe.position === "sticky" ||
      probe.transform !== "none" ||
      probe.opacity !== "1" ||
      probe.visibility !== "visible" ||
      Number(probe.zIndex) > 0;
    if (interesting || depth < 3) {
      out.push({ ...probe, role: depth === 0 ? "self" : `ancestor-${depth}` });
    }
    cur = cur.parentElement;
    depth += 1;
  }
  return out;
}

function appendLog(entry: Record<string, unknown>) {
  const row = { t: new Date().toISOString(), ...entry };
  const w = window as unknown as Record<string, unknown>;
  const prev = Array.isArray(w[LOG_KEY]) ? (w[LOG_KEY] as unknown[]) : [];
  prev.push(row);
  w[LOG_KEY] = prev.slice(-200);
  // eslint-disable-next-line no-console
  console.info("[tw-cw-debug]", row);
}

export function cwDebugLog(event: string, data: Record<string, unknown> = {}) {
  if (!isClientWorkspaceDebugEnabled()) return;
  appendLog({ event, ...data });
  renderPanelFromLast();
}

export function captureClientWorkspaceDomProbe(input: {
  event: string;
  section?: string;
  sheetOpen?: boolean;
  viewportMode?: string;
  showDetail?: boolean;
  creatorsLen?: number;
  filteredLen?: number;
}): CwDebugSnapshot | null {
  if (typeof window === "undefined" || !isClientWorkspaceDebugEnabled()) return null;

  const clist = document.querySelector(".tw-review .clist, .creators-page .clist");
  const cards = Array.from(document.querySelectorAll(".tw-review .clist .cc, .creators-page .clist .cc"));
  const firstCard = cards[0] ?? null;
  const firstMain = firstCard?.querySelector(".cc-main") ?? null;
  const details = Array.from(document.querySelectorAll(".detail"));
  const loadingOverlays = Array.from(
    document.querySelectorAll(
      ".tw-review-loading-overlay, .thinkway-navigation-loading-overlay, [aria-label='Loading campaign review']"
    )
  );
  const tab = document.querySelector(".tw-review nav.tabs .tab, .tw-review nav.tabs button.tab");

  const notes: string[] = [];
  let hitAtFirstCard: HitProbe | null = null;
  let clipAncestors: AncestorProbe[] = [];
  if (firstCard) {
    const r = firstCard.getBoundingClientRect();
    const cx = Math.min(Math.max(r.left + r.width / 2, 2), window.innerWidth - 2);
    const cy = Math.min(Math.max(r.top + r.height / 2, 2), window.innerHeight - 2);
    if (r.width > 0 && r.height > 0) {
      hitAtFirstCard = hitProbe(cx, cy);
      if (hitAtFirstCard.top.includes("cc") || hitAtFirstCard.stack.some((s) => s.includes(".cc"))) {
        notes.push("HIT: first card center resolves to a creator card (or child).");
      } else {
        notes.push(`HIT: first card center is COVERED by ${hitAtFirstCard.top}`);
      }
    } else {
      notes.push("First card has zero-sized rect.");
    }
    clipAncestors = walkClipAncestors(firstCard);
  } else {
    notes.push("No .cc nodes in DOM under .clist");
    // Probe where roster should start: below note / inside layout
    const layout = document.querySelector(".creators-page .layout, .tw-review .layout");
    if (layout) {
      const r = layout.getBoundingClientRect();
      hitAtFirstCard = hitProbe(r.left + Math.min(40, r.width / 2), r.top + 24);
      notes.push(`Fallback hit at layout top: ${hitAtFirstCard.top}`);
    }
  }

  let hitAtTabRow: HitProbe | null = null;
  if (tab) {
    const r = tab.getBoundingClientRect();
    hitAtTabRow = hitProbe(r.left + r.width / 2, r.top + r.height / 2);
  }

  const snap: CwDebugSnapshot = {
    at: new Date().toISOString(),
    event: input.event,
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
    visibilityState: document.visibilityState,
    bodyOverflow: document.body.style.overflow || "(empty)",
    bodyOverflowAttr: getComputedStyle(document.body).overflow,
    section: input.section,
    sheetOpen: input.sheetOpen,
    viewportMode: input.viewportMode,
    showDetail: input.showDetail,
    creatorsLen: input.creatorsLen,
    filteredLen: input.filteredLen,
    portalMounted: cwDebugLiveState.portalMounted,
    cardsInDom: cards.length,
    clist: clist ? describe(clist) : null,
    firstCard: firstCard ? describe(firstCard) : null,
    firstCardMain: firstMain ? describe(firstMain) : null,
    detailNodes: details.map(describe),
    loadingOverlays: loadingOverlays.map(describe),
    hitAtFirstCard,
    hitAtTabRow,
    clipAncestors,
    notes,
  };

  const w = window as unknown as Record<string, unknown>;
  w[SNAP_KEY] = snap;
  appendLog({ event: input.event, snapshot: summarize(snap) });
  renderPanel(snap);
  return snap;
}

function summarize(snap: CwDebugSnapshot) {
  return {
    event: snap.event,
    section: snap.section,
    sheetOpen: snap.sheetOpen,
    cardsInDom: snap.cardsInDom,
    filteredLen: snap.filteredLen,
    firstCard: snap.firstCard
      ? {
          rect: snap.firstCard.rect,
          display: snap.firstCard.display,
          visibility: snap.firstCard.visibility,
          opacity: snap.firstCard.opacity,
          position: snap.firstCard.position,
          zIndex: snap.firstCard.zIndex,
          zeroSized: snap.firstCard.zeroSized,
          inViewport: snap.firstCard.inViewport,
        }
      : null,
    hit: snap.hitAtFirstCard,
    details: snap.detailNodes.map((d) => ({
      className: d.className,
      display: d.display,
      visibility: d.visibility,
      position: d.position,
      zIndex: d.zIndex,
      rect: d.rect,
    })),
    bodyOverflow: snap.bodyOverflow,
    visibilityState: snap.visibilityState,
    notes: snap.notes,
  };
}

function renderPanelFromLast() {
  const w = window as unknown as Record<string, unknown>;
  const last = w[SNAP_KEY] as CwDebugSnapshot | undefined;
  if (last) renderPanel(last);
}

function renderPanel(snap: CwDebugSnapshot) {
  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.setAttribute("data-tw-cw-debug", "1");
    // pointer-events:none — must never steal tab/card clicks or cover interaction.
    Object.assign(panel.style, {
      position: "fixed",
      left: "8px",
      right: "8px",
      bottom: "8px",
      maxHeight: "36vh",
      overflow: "auto",
      zIndex: "2147483646",
      background: "rgba(8,12,24,.88)",
      color: "#9ef0b3",
      font: "11px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      padding: "10px 12px 16px",
      whiteSpace: "pre-wrap",
      pointerEvents: "none",
      borderRadius: "8px",
      WebkitOverflowScrolling: "touch",
    } as unknown as CSSStyleDeclaration);
    document.body.appendChild(panel);

    const btn = document.createElement("button");
    btn.id = `${PANEL_ID}-btn`;
    btn.type = "button";
    btn.textContent = "CW debug · capture";
    Object.assign(btn.style, {
      position: "fixed",
      top: "8px",
      right: "8px",
      zIndex: "2147483647",
      pointerEvents: "auto",
      font: "11px/1 ui-monospace, Menlo, Consolas, monospace",
      padding: "8px 10px",
      borderRadius: "6px",
      border: "1px solid #9ef0b3",
      background: "rgba(8,12,24,.92)",
      color: "#9ef0b3",
    } as unknown as CSSStyleDeclaration);
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      captureClientWorkspaceDomProbe({
        event: "panel-tap-capture",
        section: cwDebugLiveState.section,
        sheetOpen: cwDebugLiveState.sheetOpen,
        viewportMode: cwDebugLiveState.viewportMode,
        showDetail: cwDebugLiveState.showDetail,
        creatorsLen: cwDebugLiveState.creatorsLen,
        filteredLen: cwDebugLiveState.filteredLen,
      });
    });
    document.body.appendChild(btn);
  }
  const s = summarize(snap);
  panel.textContent = [
    "TW CW DEBUG (?debugCw=1) — screenshot this panel · clicks pass through",
    `event=${snap.event} @ ${snap.at}`,
    `section=${snap.section} sheetOpen=${snap.sheetOpen} viewportMode=${snap.viewportMode} showDetail=${snap.showDetail} portal=${snap.portalMounted}`,
    `creatorsLen=${snap.creatorsLen} filteredLen=${snap.filteredLen} cardsInDom=${snap.cardsInDom}`,
    `visibilityState=${snap.visibilityState} body.style.overflow=${snap.bodyOverflow} computed=${snap.bodyOverflowAttr}`,
    `clist: ${
      snap.clist
        ? `display=${snap.clist.display} vis=${snap.clist.visibility} op=${snap.clist.opacity} pos=${snap.clist.position} z=${snap.clist.zIndex} ${Math.round(snap.clist.rect.w)}x${Math.round(snap.clist.rect.h)} top=${Math.round(snap.clist.rect.top)} inView=${snap.clist.inViewport}`
        : "MISSING"
    }`,
    `firstCard: ${
      snap.firstCard
        ? `display=${snap.firstCard.display} vis=${snap.firstCard.visibility} op=${snap.firstCard.opacity} pos=${snap.firstCard.position} z=${snap.firstCard.zIndex} ${Math.round(snap.firstCard.rect.w)}x${Math.round(snap.firstCard.rect.h)} top=${Math.round(snap.firstCard.rect.top)} zero=${snap.firstCard.zeroSized} inView=${snap.firstCard.inViewport}`
        : "MISSING"
    }`,
    `cc-main: ${
      snap.firstCardMain
        ? `display=${snap.firstCardMain.display} vis=${snap.firstCardMain.visibility} op=${snap.firstCardMain.opacity} ${Math.round(snap.firstCardMain.rect.w)}x${Math.round(snap.firstCardMain.rect.h)}`
        : "MISSING"
    }`,
    `elementFromPoint(card): ${snap.hitAtFirstCard ? `${snap.hitAtFirstCard.top} @ (${Math.round(snap.hitAtFirstCard.x)},${Math.round(snap.hitAtFirstCard.y)})` : "n/a"}`,
    `elementsFromPoint: ${snap.hitAtFirstCard?.stack.join(" | ") ?? "n/a"}`,
    `elementFromPoint(tab): ${snap.hitAtTabRow?.top ?? "n/a"}`,
    `detail nodes (${snap.detailNodes.length}): ${
      snap.detailNodes
        .map(
          (d) =>
            `[${d.className}] display=${d.display} vis=${d.visibility} pos=${d.position} z=${d.zIndex} ${Math.round(d.rect.w)}x${Math.round(d.rect.h)} top=${Math.round(d.rect.top)} pe=${d.pointerEvents}`
        )
        .join(" ;; ") || "none"
    }`,
    `loading overlays: ${snap.loadingOverlays.length}`,
    `clip ancestors: ${snap.clipAncestors
      .slice(0, 8)
      .map(
        (a) =>
          `${a.role}:${a.tag}.${a.className.split(" ").slice(0, 2).join(".")} ov=${a.overflow}/${a.overflowY} pos=${a.position} z=${a.zIndex} tf=${a.transform === "none" ? "none" : "set"}`
      )
      .join(" > ")}`,
    `notes: ${snap.notes.join(" / ")}`,
    `raw: window.${SNAP_KEY}  log: window.${LOG_KEY}`,
    JSON.stringify(s, null, 0).slice(0, 1200),
  ].join("\n");
}

let lifecycleInstalled = false;

export function installClientWorkspaceDebugLifecycle(
  getState?: () => Record<string, unknown>
) {
  if (typeof window === "undefined" || !isClientWorkspaceDebugEnabled()) {
    return () => undefined;
  }
  if (lifecycleInstalled) {
    return () => undefined;
  }
  lifecycleInstalled = true;

  const mergeState = () => ({
    ...cwDebugLiveState,
    ...(getState ? getState() : {}),
  });

  const probe = (event: string) => {
    const state = mergeState();
    captureClientWorkspaceDomProbe({
      event,
      section: typeof state.section === "string" ? state.section : undefined,
      sheetOpen: typeof state.sheetOpen === "boolean" ? state.sheetOpen : undefined,
      viewportMode: typeof state.viewportMode === "string" ? state.viewportMode : undefined,
      showDetail: typeof state.showDetail === "boolean" ? state.showDetail : undefined,
      creatorsLen: typeof state.creatorsLen === "number" ? state.creatorsLen : undefined,
      filteredLen: typeof state.filteredLen === "number" ? state.filteredLen : undefined,
    });
  };

  const onVis = () => {
    cwDebugLog("visibilitychange", {
      visibilityState: document.visibilityState,
      portalMounted: cwDebugLiveState.portalMounted,
      ...mergeState(),
    });
    probe(`visibilitychange:${document.visibilityState}`);
  };
  const onPageHide = (e: PageTransitionEvent) => {
    cwDebugLog("pagehide", { persisted: e.persisted, ...mergeState() });
  };
  const onPageShow = (e: PageTransitionEvent) => {
    const main = document.querySelector(".tw-review");
    cwDebugLog("pageshow", {
      persisted: e.persisted,
      twReviewPresent: Boolean(main),
      twReviewRect: main ? describe(main).rect : null,
      portalMounted: cwDebugLiveState.portalMounted,
      detailCount: document.querySelectorAll(".detail").length,
      ...mergeState(),
    });
    probe(`pageshow:persisted=${e.persisted}`);
  };
  const onFocus = () => {
    cwDebugLog("focus", mergeState());
    probe("focus");
  };
  const onBlur = () => cwDebugLog("blur", mergeState());
  const onResize = () => probe("resize");
  const onError = (event: ErrorEvent) => {
    cwDebugLog("window.error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    cwDebugLog("unhandledrejection", {
      reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
    });
  };

  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("focus", onFocus);
  window.addEventListener("blur", onBlur);
  window.addEventListener("resize", onResize);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  // Initial + delayed probes (layout settles after fonts/images).
  probe("install");
  window.setTimeout(() => probe("t+0ms"), 0);
  window.setTimeout(() => probe("t+250ms"), 250);
  window.setTimeout(() => probe("t+1000ms"), 1000);
  window.setTimeout(() => probe("t+3000ms"), 3000);

  return () => {
    lifecycleInstalled = false;
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
