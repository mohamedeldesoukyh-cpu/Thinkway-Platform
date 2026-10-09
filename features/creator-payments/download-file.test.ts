import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { downloadFile } from './download-file';
import { BENEFICIARY_FILENAME, PAYMENT_FILENAME } from './aaib';

test('download bytes, metadata, errors and cleanup retain the existing contract', async (t) => {
    let blob: Blob | undefined;
    const anchor = { href: '', download: '', click() {} };
    const timers: { callback: () => void; delay: number }[] = [];
    const revoked: string[] = [];
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
        createElement: (tag: string) => { assert.equal(tag, 'a'); return anchor; },
    } });
    t.after(() => {
        if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
        else Reflect.deleteProperty(globalThis, 'document');
    });
    const create = t.mock.method(URL, 'createObjectURL', (value: Blob) => { blob = value; return 'blob:synthetic'; });
    t.mock.method(URL, 'revokeObjectURL', (url: string) => { revoked.push(url); });
    const click = t.mock.method(anchor, 'click');
    t.mock.method(globalThis, 'setTimeout', ((callback: () => void, delay: number) => {
        timers.push({ callback, delay }); return 0;
    }) as typeof setTimeout);
    for (const sample of [
        { data: 'AAH/gA==', name: BENEFICIARY_FILENAME, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: true, bytes: [0, 1, 255, 128] },
        { data: 'A\u00a0\u00ff\r\n', name: PAYMENT_FILENAME, mime: 'text/csv;charset=windows-1252', bytes: [65, 160, 255, 13, 10] },
        { data: 'A\u00a0', name: PAYMENT_FILENAME, mime: 'text/csv;charset=utf-8', bytes: [65, 160] },
        { data: 'أ', name: 'ordinary.txt', mime: 'text/plain;charset=utf-8', bytes: [...new TextEncoder().encode('أ')] },
        { data: '', name: 'empty.bin', mime: 'application/octet-stream', base64: true, bytes: [] },
        { data: 'AAH/', name: PAYMENT_FILENAME, mime: 'application/octet-stream', base64: true, bytes: [0, 1, 255] },
    ]) {
        const priorClicks = click.mock.callCount();
        downloadFile(sample.data, sample.name, sample.mime, sample.base64);
        assert.deepEqual([...new Uint8Array(await blob!.arrayBuffer())], sample.bytes);
        assert.equal(blob!.type, sample.mime);
        assert.equal(anchor.download, sample.name);
        assert.equal(anchor.href, 'blob:synthetic');
        assert.equal(click.mock.callCount(), priorClicks + 1);
        assert.equal(timers.at(-1)!.delay, 1000);
        const before = revoked.length;
        timers.at(-1)!.callback();
        assert.equal(revoked.length, before + 1);
        assert.equal(revoked.at(-1), 'blob:synthetic');
    }
    const beforeCreate = create.mock.callCount();
    assert.throws(() => downloadFile('%%%', 'invalid.bin', 'application/octet-stream', true));
    assert.throws(() => downloadFile('أ', PAYMENT_FILENAME, 'text/csv'), /Use English payment details/);
    assert.equal(create.mock.callCount(), beforeCreate);
    // Preserve propagation, rather than silently changing the existing error policy.
    const sentinel = new Error('synthetic click failure');
    click.mock.mockImplementation(() => { throw sentinel; });
    const beforeTimers = timers.length;
    assert.throws(() => downloadFile('x', 'test.txt', 'text/plain'), error => error === sentinel);
    assert.equal(timers.length, beforeTimers); // Existing implementation schedules cleanup only after click succeeds.
});

test('download utility dependency graph contains no UI, editor or CSS modules', async () => {
    const result = await build({ entryPoints: ['features/creator-payments/download-file.ts'], bundle: true, write: false, metafile: true, platform: 'browser', logLevel: 'silent' });
    const inputs = Object.keys(result.metafile!.inputs);
    assert.ok(inputs.some(path => path.endsWith('/aaib.ts')));
    assert.ok(inputs.every(path => !/\.css$|\.tsx$|bank-editor|components\/|index\.[jt]s$/.test(path)), inputs.join('\n'));
});
