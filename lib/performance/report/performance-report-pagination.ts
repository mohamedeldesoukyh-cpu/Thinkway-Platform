/** Shared by HTML preview and PDF: widen long-caption cards before adding pages. */
export const PERFORMANCE_REPORT_PAGINATION = `<script>
(async function () {
  await document.fonts.ready;
  const pageHeight = 297 * 96 / 25.4;
  const liveSheets = document.getElementsByClassName('sheet');
  for (let pageIndex = 0; pageIndex < liveSheets.length; pageIndex++) {
    const original = liveSheets[pageIndex];
    const originalGrid = original.querySelector('.pgrid');
    if (!originalGrid) continue;
    const sheet = original;
    const grid = originalGrid;
    while (sheet.getBoundingClientRect().height > pageHeight + 1 && grid.children.length > 1) {
      const overflow = grid.lastElementChild;
      let next = sheet.nextElementSibling;
      if (!next || next.dataset.continuation !== 'true') {
        next = sheet.cloneNode(true);
        next.removeAttribute('id');
        next.dataset.continuation = 'true';
        next.querySelector('.sheet__body').innerHTML = '<div class="pgrid"></div>';
        const heading = next.querySelector('.sheet__head .hm:last-child');
        if (heading) heading.textContent = 'Continued';
        sheet.after(next);
      }
      next.querySelector('.pgrid').prepend(overflow);
      grid.style.gridTemplateColumns = 'repeat(' + grid.children.length + ',minmax(0,1fr))';
      next.querySelector('.pgrid').style.gridTemplateColumns = 'repeat(' + next.querySelector('.pgrid').children.length + ',minmax(0,1fr))';
    }
    // Exceptionally long captions continue at full font size, without repeating metrics.
    while (sheet.getBoundingClientRect().height > pageHeight + 1) {
      const copy = Array.from(grid.querySelectorAll('.pcard__cap,.pcard__tg'))
        .sort((a, b) => b.textContent.length - a.textContent.length)[0];
      if (!copy || !copy.textContent.length) break;
      const text = copy.textContent;
      let low = 0, high = text.length;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        copy.textContent = text.slice(0, middle);
        if (sheet.getBoundingClientRect().height <= pageHeight + 1) low = middle;
        else high = middle - 1;
      }
      copy.textContent = text.slice(0, low);
      const next = sheet.cloneNode(true);
      next.removeAttribute('id');
      const body = next.querySelector('.sheet__body');
      body.innerHTML = '<div class="pgrid" style="grid-template-columns:1fr"><article class="pcard"></article></div>';
      const creator = grid.querySelector('.pcard__hd');
      if (creator) body.querySelector('.pcard').append(creator.cloneNode(true));
      const continuation = copy.parentElement.cloneNode(true);
      continuation.querySelector('.pcard__cap,.pcard__tg').textContent = text.slice(low);
      body.querySelector('.pcard').append(continuation);
      const heading = next.querySelector('.sheet__head .hm:last-child');
      if (heading) heading.textContent = 'Caption / tags continued';
      sheet.after(next);
    }
  }
  const sheets = Array.from(document.querySelectorAll('.sheet'));
  sheets.forEach((sheet, index) => {
    const label = sheet.querySelector('.pg');
    if (label) label.textContent = (index + 1) + ' / ' + sheets.length;
  });
  document.documentElement.setAttribute('data-performance-ready', 'true');
})();
</script>`;
