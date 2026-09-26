import assert from 'node:assert/strict';
import test from 'node:test';
import fixture from '../../tests/fixtures/deliverables-mixed-84.json';
import { buildPanelRows, filterPanelRows, validatePanelUpload, type PanelSnapshot } from './deliverables-panel-model';
import type { DocumentationUnitSummary } from '@/lib/services/deliverables/documentation-types';
const unit = { unitKey: 'd:one', assignmentDeliverableId: 'one', assignmentPostScheduleId: null, quantity: 1, sequenceNumber: null, creatorName: 'Creator', label: 'Reel' } as DocumentationUnitSummary;
const empty: PanelSnapshot = { assets: [], metadata: {}, scripts: ['d:one'] };
test('84 mixed deliverables discriminate every filter and omit satisfied creators', () => {
    const units = fixture.map(r => ({ ...unit, unitKey: `d:${r.id}`, assignmentDeliverableId: r.id, creatorId: r.creatorId, creatorName: r.creator, platform: r.platform }));
    const assets = fixture.filter(r => r.status !== 'missing').map(r => ({ deliverableId: r.id, postId: null, hasContent: true, type: 'draft_video', uploadedAt: '2026-09-26', releasedAt: r.status === 'uploaded' ? null : '2026-09-26', decision: r.status === 'approved' ? 'approved' : null } as PanelSnapshot['assets'][number]));
    const rows = buildPanelRows(units, { ...empty, assets });
    for (const [status, count] of Object.entries({ missing: 30, uploaded: 24, review: 18, approved: 12, all: 84 })) {
        assert.equal(filterPanelRows(rows, status as 'all' | 'missing' | 'uploaded' | 'review' | 'approved', '').length, count);
    }
    assert.equal(filterPanelRows(rows, 'missing', 'Creator 28').length, 0);
    assert.equal(filterPanelRows(rows, 'all', 'Creator 28').length, 3);
});
test('Reference scripts do not count as uploaded or client review work', () => {
    const rows = buildPanelRows([unit], empty);
    assert.equal(rows[0].status, 'missing');
    assert.equal(rows[0].hasScript, true);
    assert.equal(filterPanelRows(rows, 'review', '').length, 0);
});
test('Only current completed content determines delivery and client state', () => {
    const asset = { deliverableId: 'one', postId: null, hasContent: true, type: 'draft_video', uploadedAt: '2026-09-26', releasedAt: null, decision: null } as PanelSnapshot['assets'][number];
    assert.equal(buildPanelRows([unit], { ...empty, assets: [asset] })[0].status, 'uploaded');
    assert.equal(buildPanelRows([unit], { ...empty, assets: [{ ...asset, releasedAt: '2026-09-26' }] })[0].status, 'review');
    assert.equal(buildPanelRows([unit], { ...empty, assets: [{ ...asset, decision: 'approved' }] })[0].status, 'approved');
    assert.equal(buildPanelRows([unit], { ...empty, assets: [{ ...asset, hasContent: false }] })[0].status, 'missing');
});
test('Search intersects status; slot assets never leak to another numbered slot', () => {
    const units = [{ ...unit, quantity: 2, assignmentPostScheduleId: 'p1', unitKey: 'p:p1' }, { ...unit, quantity: 2, assignmentPostScheduleId: 'p2', unitKey: 'p:p2' }];
    const asset = { deliverableId: 'one', postId: 'p1', hasContent: true, type: 'draft_video', uploadedAt: '2026-09-26' } as PanelSnapshot['assets'][number];
    const rows = buildPanelRows(units, { ...empty, assets: [asset] });
    assert.deepEqual(rows.map(r => r.status), ['uploaded', 'missing']);
    assert.equal(filterPanelRows(rows, 'missing', 'creator').length, 1);
    assert.equal(filterPanelRows(rows, 'missing', 'absent').length, 0);
});
test('Upload limits enforce extension, MIME and the 150 MB boundary', () => {
    assert.equal(validatePanelUpload({ fileName: 'clip.mp4', mimeType: 'video/mp4', fileSize: 150 * 1024 * 1024 }), null);
    assert.ok(validatePanelUpload({ fileName: 'clip.mp4', mimeType: 'video/mp4', fileSize: 150 * 1024 * 1024 + 1 }));
    assert.ok(validatePanelUpload({ fileName: 'program.exe', mimeType: 'video/mp4', fileSize: 1024 }));
    assert.ok(validatePanelUpload({ fileName: 'clip.mp4', mimeType: 'application/octet-stream', fileSize: 1024 }));
});
