/**
 * Thinkway Showcase pagination engine — single source of truth for preview + PDF.
 *
 * Browser path: measure DOM → pack atomic blocks → emit fixed A4 landscape pages.
 * Puppeteer only prints the already-paginated DOM (preferCSSPageSize).
 */

export type PackBlock = {
  id: string;
  height: number;
  /** Whole block moves together; never mid-split. */
  atomic: boolean;
  /** When true and block is a table wrapper, rows may spill to the next page. */
  allowTableRowSplit: boolean;
  /** Pre-measured row heights (tbody tr), only when allowTableRowSplit. */
  rowHeights?: number[];
  /** Measured thead (and similar) height consumed once per page slice. */
  tableChromeHeight?: number;
};

export type PackedPagePlan = {
  blockIds: string[];
  /** For table-split blocks: which row index ranges land on this page. */
  tableSlices?: Record<string, { start: number; end: number }>;
};

export type PackPagesInput = {
  contentHeight: number;
  blocks: PackBlock[];
};

/**
 * Pure packer — given measured heights, return page plans.
 * Oversized atomic blocks still get their own page (never split).
 */
export function packBlocksIntoPages(input: PackPagesInput): PackedPagePlan[] {
  const contentHeight = Math.max(1, input.contentHeight);
  const pages: PackedPagePlan[] = [];
  let blockIds: string[] = [];
  let tableSlices: Record<string, { start: number; end: number }> = {};
  let remaining = contentHeight;

  const flush = () => {
    if (blockIds.length === 0) return;
    pages.push({ blockIds, tableSlices });
    blockIds = [];
    tableSlices = {};
    remaining = contentHeight;
  };

  for (const block of input.blocks) {
    if (block.allowTableRowSplit && block.rowHeights && block.rowHeights.length > 0) {
      const chrome = Math.max(0, block.tableChromeHeight ?? 0);
      let rowIndex = 0;

      while (rowIndex < block.rowHeights.length) {
        const firstRow = block.rowHeights[rowIndex] ?? 0;
        if (blockIds.length > 0 && chrome + firstRow > remaining) {
          flush();
        }

        if (!blockIds.includes(block.id)) {
          blockIds.push(block.id);
          remaining -= chrome;
          tableSlices[block.id] = { start: rowIndex, end: rowIndex };
        }

        const start = rowIndex;
        while (rowIndex < block.rowHeights.length) {
          const rh = block.rowHeights[rowIndex] ?? 0;
          if (rh > remaining && rowIndex > start) break;
          if (rh > remaining && rowIndex === start) {
            tableSlices[block.id] = {
              start: tableSlices[block.id]?.start ?? start,
              end: rowIndex + 1,
            };
            remaining = 0;
            rowIndex += 1;
            break;
          }
          remaining -= rh;
          rowIndex += 1;
          tableSlices[block.id] = {
            start: tableSlices[block.id]?.start ?? start,
            end: rowIndex,
          };
        }

        if (rowIndex < block.rowHeights.length) {
          flush();
        }
      }
      continue;
    }

    const h = Math.max(0, block.height);
    if (blockIds.length > 0 && h > remaining) {
      flush();
    }
    blockIds.push(block.id);
    remaining -= h;
  }

  flush();
  return pages;
}

/** Attribute set on <html> when pagination finishes (preview + Puppeteer gate). */
export const SHORTLIST_PAGINATION_READY_ATTR = "data-sl-paginated";
export const SHORTLIST_PAGINATION_READY_VALUE = "ready";

/**
 * Inline browser engine. Kept as a string so preview iframe and PDF HTML share
 * the exact same runtime (no second layout pass in Puppeteer).
 */
export function buildShortlistPaginationRuntimeScript(): string {
  return `(function(){
  var READY_ATTR = ${JSON.stringify(SHORTLIST_PAGINATION_READY_ATTR)};
  var READY_VALUE = ${JSON.stringify(SHORTLIST_PAGINATION_READY_VALUE)};

  function measureHeight(el){
    if(!el) return 0;
    var rect = el.getBoundingClientRect();
    var h = Math.max(el.offsetHeight || 0, el.scrollHeight || 0, rect.height || 0);
    var style = window.getComputedStyle(el);
    var mt = parseFloat(style.marginTop) || 0;
    var mb = parseFloat(style.marginBottom) || 0;
    return h + mt + mb;
  }

  function packBlocksIntoPages(contentHeight, blocks){
    var pages = [];
    var blockIds = [];
    var tableSlices = {};
    var remaining = Math.max(1, contentHeight);
    function flush(){
      if(!blockIds.length) return;
      pages.push({ blockIds: blockIds, tableSlices: tableSlices });
      blockIds = [];
      tableSlices = {};
      remaining = Math.max(1, contentHeight);
    }
    for(var i=0;i<blocks.length;i++){
      var block = blocks[i];
      if(block.allowTableRowSplit && block.rowHeights && block.rowHeights.length){
        var chrome = Math.max(0, block.tableChromeHeight || 0);
        var rowIndex = 0;
        while(rowIndex < block.rowHeights.length){
          var firstRow = block.rowHeights[rowIndex] || 0;
          if(blockIds.length && chrome + firstRow > remaining){ flush(); }
          if(blockIds.indexOf(block.id) === -1){
            blockIds.push(block.id);
            remaining -= chrome;
            tableSlices[block.id] = { start: rowIndex, end: rowIndex };
          }
          var start = rowIndex;
          while(rowIndex < block.rowHeights.length){
            var rh = block.rowHeights[rowIndex] || 0;
            if(rh > remaining && rowIndex > start) break;
            if(rh > remaining && rowIndex === start){
              tableSlices[block.id] = {
                start: (tableSlices[block.id] && tableSlices[block.id].start != null) ? tableSlices[block.id].start : start,
                end: rowIndex + 1
              };
              remaining = 0;
              rowIndex += 1;
              break;
            }
            remaining -= rh;
            rowIndex += 1;
            tableSlices[block.id] = {
              start: (tableSlices[block.id] && tableSlices[block.id].start != null) ? tableSlices[block.id].start : start,
              end: rowIndex
            };
          }
          if(rowIndex < block.rowHeights.length) flush();
        }
        continue;
      }
      var h = Math.max(0, block.height);
      if(blockIds.length && h > remaining) flush();
      blockIds.push(block.id);
      remaining -= h;
    }
    flush();
    return pages;
  }

  function createProbePad(isCover){
    var page = document.createElement("section");
    page.className = "page" + (isCover ? " cover" : "");
    page.style.position = "absolute";
    page.style.left = "-10000px";
    page.style.top = "0";
    page.style.visibility = "hidden";
    page.setAttribute("aria-hidden", "true");
    var pad = document.createElement("div");
    pad.className = "pad";
    page.appendChild(pad);
    var foot = document.createElement("div");
    foot.className = "foot";
    foot.innerHTML = "<span>.</span><span>.</span>";
    page.appendChild(foot);
    document.body.appendChild(page);
    var height = pad.clientHeight || pad.offsetHeight || 0;
    page.remove();
    return height;
  }

  function cloneBlockForPage(source, slice){
    var clone = source.cloneNode(true);
    clone.removeAttribute("data-sl-block");
    clone.removeAttribute("id");
    if(slice && clone.getAttribute("data-sl-table-split") === "true"){
      var rows = clone.querySelectorAll("tbody tr");
      for(var r = rows.length - 1; r >= 0; r--){
        if(r < slice.start || r >= slice.end) rows[r].remove();
      }
    }
    return clone;
  }

  function buildPage(flow, blockMap, plan, pageIndex, pageCount){
    var section = document.createElement("section");
    var pageClass = flow.getAttribute("data-sl-page-class") || "page";
    section.className = pageClass;
    section.setAttribute("data-sl-engine-page", "1");
    var pad = document.createElement("div");
    pad.className = "pad";
    for(var i=0;i<plan.blockIds.length;i++){
      var id = plan.blockIds[i];
      var source = blockMap[id];
      if(!source) continue;
      var slice = plan.tableSlices && plan.tableSlices[id];
      pad.appendChild(cloneBlockForPage(source, slice));
    }
    section.appendChild(pad);
    var foot = document.createElement("div");
    foot.className = "foot";
    var left = flow.getAttribute("data-sl-footer-left") || "";
    var rightBase = flow.getAttribute("data-sl-footer-right") || "";
    var right = pageCount > 1 ? (rightBase + " · " + (pageIndex + 1)) : rightBase;
    var leftEl = document.createElement("span");
    leftEl.textContent = left;
    var rightEl = document.createElement("span");
    rightEl.className = "mono";
    rightEl.textContent = right;
    foot.appendChild(leftEl);
    foot.appendChild(rightEl);
    section.appendChild(foot);
    return section;
  }

  function paginateShowcase(){
    var measureRoot = document.getElementById("sl-measure-root");
    var pageRoot = document.getElementById("sl-page-root");
    if(!measureRoot || !pageRoot){
      document.documentElement.setAttribute(READY_ATTR, READY_VALUE);
      window.__SHORTLIST_PAGINATION_READY__ = true;
      return;
    }

    var contentHeightDefault = createProbePad(false);
    var contentHeightCover = createProbePad(true);
    if(contentHeightDefault < 40){
      contentHeightDefault = 746;
      contentHeightCover = 746;
    }

    var flows = Array.prototype.slice.call(
      measureRoot.querySelectorAll("[data-sl-flow]")
    );
    pageRoot.innerHTML = "";

    for(var f=0; f<flows.length; f++){
      var flow = flows[f];
      var isCover = (flow.getAttribute("data-sl-page-class") || "").indexOf("cover") !== -1;
      var contentHeight = isCover ? contentHeightCover : contentHeightDefault;
      var exclusive = flow.getAttribute("data-sl-exclusive") === "true";
      var blockEls = Array.prototype.slice.call(
        flow.querySelectorAll(":scope > [data-sl-block]")
      );
      var blocks = [];
      var blockMap = {};
      for(var b=0; b<blockEls.length; b++){
        var el = blockEls[b];
        var id = el.getAttribute("data-sl-block-id") || ("b" + f + "-" + b);
        el.setAttribute("data-sl-block-id", id);
        blockMap[id] = el;
        var allowSplit = el.getAttribute("data-sl-table-split") === "true";
        var rowHeights = [];
        var chromeHeight = 0;
        if(allowSplit){
          var table = el.querySelector("table");
          var tbody = table ? table.querySelector("tbody") : null;
          var rows = tbody ? tbody.querySelectorAll("tr") : [];
          var rowsSum = 0;
          for(var ri=0; ri<rows.length; ri++){
            var rh = measureHeight(rows[ri]);
            rowHeights.push(rh);
            rowsSum += rh;
          }
          // Header/card chrome = full block minus body rows (measured, not estimated).
          chromeHeight = Math.max(0, measureHeight(el) - rowsSum);
        }
        blocks.push({
          id: id,
          height: measureHeight(el),
          atomic: el.getAttribute("data-sl-atomic") !== "false",
          allowTableRowSplit: allowSplit,
          rowHeights: rowHeights,
          tableChromeHeight: chromeHeight
        });
      }

      var plans;
      if(exclusive){
        plans = blocks.length
          ? [{ blockIds: blocks.map(function(x){ return x.id; }), tableSlices: {} }]
          : [];
      } else {
        plans = packBlocksIntoPages(contentHeight, blocks);
      }

      for(var p=0; p<plans.length; p++){
        pageRoot.appendChild(buildPage(flow, blockMap, plans[p], p, plans.length));
      }
    }

    measureRoot.setAttribute("hidden", "");
    measureRoot.style.display = "none";
    document.documentElement.setAttribute(READY_ATTR, READY_VALUE);
    window.__SHORTLIST_PAGINATION_READY__ = true;
  }

  function waitAssetsThenPaginate(){
    var done = function(){
      try { paginateShowcase(); }
      catch (err) {
        console.error("[shortlist-pagination]", err);
        document.documentElement.setAttribute(READY_ATTR, READY_VALUE);
        window.__SHORTLIST_PAGINATION_READY__ = true;
      }
    };
    var fontsReady = (document.fonts && document.fonts.ready)
      ? document.fonts.ready.catch(function(){})
      : Promise.resolve();
    var images = Array.prototype.slice.call(document.images || []);
    var imageReady = Promise.all(images.map(function(img){
      if(img.complete) return Promise.resolve();
      return new Promise(function(resolve){
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    }));
    Promise.all([fontsReady, imageReady]).then(function(){
      requestAnimationFrame(function(){ requestAnimationFrame(done); });
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", waitAssetsThenPaginate);
  } else {
    waitAssetsThenPaginate();
  }
})();`;
}
