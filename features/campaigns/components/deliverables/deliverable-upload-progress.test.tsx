import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { DeliverableUploadProgress, type CardUploadProgress } from './deliverable-upload-progress';
const base: CardUploadProgress = { unitKey: 'fixture', fileName: 'sample.mov', phase: 'uploading', loaded: 25, total: 100 };
const render = (changes: Partial<CardUploadProgress> = {}) => renderToStaticMarkup(<DeliverableUploadProgress progress={{ ...base, ...changes }} />);
test('card shows real byte progress and filename', () => {
  const html = render();
  assert.match(html, /aria-valuenow="25"/);
  assert.match(html, /25%/);
  assert.match(html, /sample.mov/);
  assert.match(html, /stroke-dasharray="25 100"/);
});
test('preparing and saving are indeterminate, not completed percentages', () => {
  for (const phase of ['preparing', 'finishing'] as const) {
    const html = render({ phase });
    assert.doesNotMatch(html, /aria-valuenow=/);
    assert.match(html, /is-pending/);
  }
  assert.match(render({ phase: 'finishing' }), /Saving upload/);
});
test('unknown length remains indeterminate and byte progress is bounded', () => {
  assert.doesNotMatch(render({ total: 0 }), /aria-valuenow=/);
  assert.match(render({ loaded: 120 }), /aria-valuenow="100"/);
  assert.match(render({ loaded: -10 }), /aria-valuenow="0"/);
});
test('panel scopes card and editor progress to the uploading unit and clears it on completion/error', () => {
  const source = readFileSync(new URL('./deliverables-panel.tsx', import.meta.url), 'utf8');
  assert.match(source, /progress\?\.unitKey === row\.unitKey \? <DeliverableUploadProgress/);
  assert.match(source, /progress\?\.unitKey === active\.unitKey \? progress : null/);
  assert.match(source, /finally\s*\{[^}]*setProgress\(null\)/);
  assert.doesNotMatch(source, /<p role="status" style=\{\{ padding: 15 \}\}>\{progress\}/);
});
