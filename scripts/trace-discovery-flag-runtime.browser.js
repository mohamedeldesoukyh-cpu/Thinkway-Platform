/**
 * Paste into DevTools console on /discovery/search while a "missing flag" row is visible.
 *
 *   copy(await window.__TW_FLAG_TRACE__.traceVisibleRows())
 *   await window.__TW_FLAG_TRACE__.traceRowAtPoint() // then click the avatar
 *
 * Or: node scripts/trace-discovery-flag-runtime.mjs --url http://localhost:3000/discovery/search
 */
(function twFlagTraceRuntime() {
  const PROBE_BASELINE = {
    source: "flag-render-probe-full-chain",
    countryFlagCodes: ["EG"],
    expectsFlagDom: true,
    flagSlot: {
      className: "discovery-search-exact-flag",
      width: 22,
      height: 22,
      visibility: "visible",
      opacity: "1",
      zIndex: "1",
      position: "absolute",
    },
    componentTree: [
      "discovery-search-exact-row",
      "discovery-search-exact-photo-wrap",
      "discovery-search-exact-flag",
      "CountryFlagsStack/CountryFlagBadge",
      "img[flagcdn]",
    ],
  };

  function fiberKey(obj) {
    return obj
      ? Object.keys(obj).find(
          (k) =>
            k.startsWith("__reactFiber$") ||
            k.startsWith("__reactInternalInstance$")
        )
      : null;
  }

  function propsKey(obj) {
    return obj
      ? Object.keys(obj).find(
          (k) => k.startsWith("__reactProps$") || k.startsWith("__reactEventHandlers$")
        )
      : null;
  }

  function getFiber(node) {
    if (!node) return null;
    const key = fiberKey(node);
    return key ? node[key] : null;
  }

  function walkFiber(fiber, visit, depth = 0) {
    if (!fiber || depth > 40) return;
    visit(fiber, depth);
    walkFiber(fiber.child, visit, depth + 1);
    walkFiber(fiber.sibling, visit, depth);
  }

  function findCreatorFiber(startNode) {
    let fiber = getFiber(startNode);
    const seen = new Set();
    while (fiber && !seen.has(fiber)) {
      seen.add(fiber);
      const props = fiber.memoizedProps || fiber.pendingProps;
      if (props?.creator?.unified_id || props?.creator?.influencer_id) {
        return { fiber, props };
      }
      // Virtual row wrapper often holds creator one level down
      let child = fiber.child;
      let hops = 0;
      while (child && hops < 12) {
        const cp = child.memoizedProps || child.pendingProps;
        if (cp?.creator?.unified_id || cp?.creator?.influencer_id) {
          return { fiber: child, props: cp };
        }
        child = child.child;
        hops += 1;
      }
      fiber = fiber.return;
    }
    return null;
  }

  function findFlagsStackProps(startNode) {
    const rootFiber = getFiber(startNode);
    let found = null;
    walkFiber(rootFiber, (fiber) => {
      if (found) return;
      const type = fiber.type;
      const name =
        (typeof type === "function" && (type.displayName || type.name)) ||
        (typeof type === "object" && type?.displayName) ||
        "";
      const props = fiber.memoizedProps || fiber.pendingProps;
      if (
        name.includes("CountryFlagsStack") ||
        (props &&
          Object.prototype.hasOwnProperty.call(props, "countryCodes") &&
          Object.prototype.hasOwnProperty.call(props, "overlay") &&
          (props.size === "md" || props.size === "sm" || props.size === "lg"))
      ) {
        // Prefer CountryFlagsStack over unrelated countryCodes consumers
        if (name.includes("CountryFlagsStack") || props.overlay === true) {
          found = { name: name || "anonymous", props };
        }
      }
    });
    return found;
  }

  function vmFromCreator(creator) {
    if (!creator) return null;
    // Mirror resolveCreatorCountryCodes merge used by ViewModel (best-effort in browser).
    const codes = [];
    const push = (v) => {
      if (!v) return;
      const n = String(v).trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(n) && !codes.includes(n)) codes.push(n);
    };
    if (Array.isArray(creator.country_codes)) creator.country_codes.forEach(push);
    push(creator.country_code);
    push(creator.estimated_country);
    for (const p of creator.platforms || []) push(p.audience_country);
    return codes;
  }

  function describeDom(rowEl) {
    const flag = rowEl.querySelector(".discovery-search-exact-flag");
    const badge = flag?.querySelector("[aria-label]");
    const img = flag?.querySelector("img");
    const star = rowEl.querySelector(".discovery-search-exact-star");
    const wrap = rowEl.querySelector(".discovery-search-exact-photo-wrap");
    const isExactRow = rowEl.classList.contains("discovery-search-exact-row");
    const tree = [];
    if (isExactRow) tree.push("discovery-search-exact-row");
    if (wrap) tree.push("discovery-search-exact-photo-wrap");
    if (flag) tree.push("discovery-search-exact-flag");
    if (badge) tree.push("CountryFlagBadge(aria-label=" + (badge.getAttribute("aria-label") || "") + ")");
    if (img) tree.push("img[src=" + (img.getAttribute("src") || "").slice(0, 80) + "]");
    if (!flag) tree.push("MISSING:.discovery-search-exact-flag");

    const cs = flag ? getComputedStyle(flag) : null;
    const rect = flag?.getBoundingClientRect();
    return {
      hasExactRowClass: isExactRow,
      hasPhotoWrap: Boolean(wrap),
      hasFlagSlot: Boolean(flag),
      hasFlagImg: Boolean(img),
      hasStar: Boolean(star),
      flagOuterHTML: flag?.outerHTML?.slice(0, 600) ?? null,
      flagComputed: cs
        ? {
            width: cs.width,
            height: cs.height,
            visibility: cs.visibility,
            opacity: cs.opacity,
            display: cs.display,
            zIndex: cs.zIndex,
            position: cs.position,
          }
        : null,
      flagRect: rect
        ? {
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
            left: Math.round(rect.left * 10) / 10,
            top: Math.round(rect.top * 10) / 10,
          }
        : null,
      componentTreeObserved: tree,
    };
  }

  function virtualMeta(rowEl) {
    const virtualItem =
      rowEl.closest("[data-index]") ||
      rowEl.parentElement?.closest?.("[data-index]") ||
      null;
    // React key is not on DOM; approximate from fiber key + data-index
    let reactKey = null;
    const itemFiber = virtualItem ? getFiber(virtualItem) : getFiber(rowEl);
    if (itemFiber?.key != null) reactKey = String(itemFiber.key);
    // Walk up for key on virtual row fiber
    let f = itemFiber;
    for (let i = 0; i < 8 && f; i++) {
      if (f.key != null) {
        reactKey = String(f.key);
        break;
      }
      f = f.return;
    }
    return {
      virtualRowIndex:
        virtualItem?.getAttribute("data-index") != null
          ? Number(virtualItem.getAttribute("data-index"))
          : null,
      virtualItemKey: reactKey,
      virtualItemDataIndexAttr: virtualItem?.getAttribute("data-index") ?? null,
      virtualItemClassName: virtualItem?.className ?? null,
    };
  }

  function classify(capture) {
    const codes = capture.countryFlagCodesDerived || [];
    const stackProps = capture.countryFlagsStackProps?.countryCodes;
    const hasDomFlag = capture.dom?.hasFlagSlot;

    if (!capture.creatorId) {
      return {
        category: "different_component_tree",
        reason: "No creator props found on React fiber — not Discovery exact-row tree",
      };
    }
    if (!capture.dom?.hasExactRowClass) {
      return {
        category: "different_component_tree",
        reason: "Row node is not .discovery-search-exact-row",
      };
    }
    if (codes.length === 0 && (!stackProps || stackProps.length === 0)) {
      return {
        category: "empty_props",
        reason: "Creator country fields empty → ViewModel/stack would omit flag",
      };
    }
    if (
      capture.virtual?.virtualItemKey &&
      capture.creatorId &&
      !String(capture.virtual.virtualItemKey).includes(
        String(capture.creatorId).replace(/^inf:/, "")
      ) &&
      capture.virtual.virtualItemKey !== capture.creatorId &&
      !String(capture.virtual.virtualItemKey).includes(capture.creatorId)
    ) {
      // Soft signal only — keys are often unified_id
      if (
        capture.creatorUnifiedId &&
        capture.virtual.virtualItemKey !== capture.creatorUnifiedId
      ) {
        return {
          category: "virtualization_reuse_mismatch",
          reason:
            "Virtual item key does not match creator unified_id (possible reuse/stale binding)",
        };
      }
    }
    if (codes.length > 0 && stackProps && stackProps.length === 0) {
      return {
        category: "stale_props",
        reason: "Creator has country codes but CountryFlagsStack received empty countryCodes",
      };
    }
    if (codes.length > 0 && !hasDomFlag) {
      return {
        category: "stale_props_or_conditional_skip",
        reason:
          "Country codes present on creator but .discovery-search-exact-flag absent from DOM",
      };
    }
    if (codes.length > 0 && hasDomFlag) {
      return {
        category: "props_and_dom_ok",
        reason:
          "Props and flag DOM present — if user still sees nothing, paint/CDN at runtime (out of prior CSS probe scope)",
      };
    }
    return { category: "unknown", reason: "Unable to classify" };
  }

  function firstDivergence(capture) {
    const probe = PROBE_BASELINE;
    const steps = [];

    const push = (point, live, expected, ok) => {
      steps.push({ point, live, expected, ok });
    };

    push(
      "1.component_tree",
      capture.dom?.componentTreeObserved,
      probe.componentTree,
      Boolean(capture.dom?.hasExactRowClass && capture.dom?.hasPhotoWrap)
    );
    push(
      "2.creator_id_present",
      capture.creatorId,
      "non-empty",
      Boolean(capture.creatorId)
    );
    push(
      "3.countryFlagCodes_non_empty",
      capture.countryFlagCodesDerived,
      probe.countryFlagCodes,
      (capture.countryFlagCodesDerived || []).length > 0
    );
    push(
      "4.CountryFlagsStack_props",
      capture.countryFlagsStackProps,
      { countryCodes: ["EG"], size: "md", overlay: true },
      Boolean(capture.countryFlagsStackProps?.countryCodes?.length)
    );
    push(
      "5.flag_dom_slot",
      capture.dom?.hasFlagSlot,
      true,
      capture.dom?.hasFlagSlot === true
    );
    push(
      "6.flag_geometry",
      capture.dom?.flagComputed,
      probe.flagSlot,
      capture.dom?.flagRect?.width > 0 && capture.dom?.flagComputed?.visibility === "visible"
    );

    const first = steps.find((s) => !s.ok) || null;
    return { firstDivergence: first, steps };
  }

  function captureRow(rowEl) {
    const hit = findCreatorFiber(rowEl);
    const creator = hit?.props?.creator ?? null;
    const stack = findFlagsStackProps(rowEl);
    const derived = vmFromCreator(creator);
    const dom = describeDom(rowEl);
    const virtual = virtualMeta(rowEl);

    const capture = {
      capturedAt: new Date().toISOString(),
      creatorId: creator?.influencer_id ?? creator?.unified_id ?? null,
      creatorUnifiedId: creator?.unified_id ?? null,
      displayName: creator?.display_name ?? null,
      countryFlagCodesDerived: derived,
      country_codes: creator?.country_codes ?? null,
      country_code: creator?.country_code ?? null,
      estimated_country: creator?.estimated_country ?? null,
      audience_country: (creator?.platforms || []).map((p) => p.audience_country),
      countryFlagsStackProps: stack
        ? {
            name: stack.name,
            countryCodes: stack.props.countryCodes,
            size: stack.props.size,
            overlay: stack.props.overlay,
            className: stack.props.className,
            maxVisible: stack.props.maxVisible,
          }
        : null,
      reactFiberKey: hit?.fiber?.key != null ? String(hit.fiber.key) : null,
      virtual,
      dom,
      classification: null,
      probeComparison: null,
    };
    capture.classification = classify(capture);
    capture.probeComparison = firstDivergence(capture);
    return capture;
  }

  function visibleExactRows() {
    return [...document.querySelectorAll(".discovery-search-exact-row")].filter(
      (el) => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
      }
    );
  }

  async function traceVisibleRows() {
    const rows = visibleExactRows();
    const captures = rows.map(captureRow);
    const missingDom = captures.filter(
      (c) =>
        (c.countryFlagCodesDerived || []).length > 0 && !c.dom?.hasFlagSlot
    );
    const emptyProps = captures.filter(
      (c) => (c.countryFlagCodesDerived || []).length === 0
    );
    const report = {
      url: location.href,
      capturedAt: new Date().toISOString(),
      visibleRowCount: captures.length,
      missingFlagDomDespiteCodes: missingDom.length,
      emptyCountryProps: emptyProps.length,
      probeBaseline: PROBE_BASELINE,
      firstDivergenceAcrossVisible:
        missingDom[0]?.probeComparison?.firstDivergence ||
        emptyProps[0]?.probeComparison?.firstDivergence ||
        captures[0]?.probeComparison?.firstDivergence ||
        null,
      captures,
    };
    console.log("[twFlagTrace]", report);
    return report;
  }

  function traceRowAtPoint() {
    return new Promise((resolve) => {
      console.info("[twFlagTrace] Click the avatar of the row with the missing flag…");
      const onClick = (event) => {
        document.removeEventListener("click", onClick, true);
        const row = event.target.closest?.(".discovery-search-exact-row");
        if (!row) {
          const report = {
            error: "Click did not land on .discovery-search-exact-row",
            target: event.target?.className ?? null,
          };
          console.warn("[twFlagTrace]", report);
          resolve(report);
          return;
        }
        const capture = captureRow(row);
        console.log("[twFlagTrace] row", capture);
        resolve(capture);
      };
      document.addEventListener("click", onClick, true);
    });
  }

  window.__TW_FLAG_TRACE__ = {
    traceVisibleRows,
    traceRowAtPoint,
    captureRow,
    PROBE_BASELINE,
  };
  console.info(
    "[twFlagTrace] Ready. Run: await __TW_FLAG_TRACE__.traceVisibleRows() or await __TW_FLAG_TRACE__.traceRowAtPoint()"
  );
})();
