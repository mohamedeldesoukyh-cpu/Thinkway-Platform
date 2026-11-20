import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { buildPptxFromPageImages } from './pptx-page-images';

test('shortlist slides use standard widescreen dimensions, preserve aspect and links', async () => {
  const buffer = await buildPptxFromPageImages([{ buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64'), contentType: 'png', links: [{x:0,y:0,w:1,h:1,href:'https://example.com'}] }], 'Widescreen fixture', { widescreen: true });
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('ppt/presentation.xml')!.async('string');
  assert.match(xml, /cx="12192000" cy="6858000"/);
  const slide = await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert.match(slide, /hlinkClick/);
  const x = Number(slide.slice(slide.indexOf('<p:pic>')).match(/<a:off x="(\d+)" y="0"/)?.[1]);
  assert.ok(x > 0, 'A4 content is centered rather than stretched or clipped');
  const rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
  assert.match(rels, /https:\/\/example.com/);
});
