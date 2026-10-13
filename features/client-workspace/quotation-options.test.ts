import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCreatorQuotationOptions, validateQuotationOptionChoice, chosenQuotationItemIds, reconcileQuotationOptionTotals } from './quotation-options';
import { quotationItemSnapshotCreator, overlayQuotationDetailOnCreators } from './quotation-client-overlay';
import { parseSnapshotCreator, fingerprintFromSnapshotCreators } from './snapshot';
import { quotationOptionSelectionState, itemIdsForClientSelection, countQuotationClientSelections } from '../quotations/quotation-client-review';
import { quotationItemsForClient } from './source-readiness';
import type { QuotationItemRow } from '@/lib/domains/commercial/quotation-detail-types';
import type { ClientReviewRecord } from './types';
const row = (id: string, option: number, revenue: number, creator = 'inf-a') => ({ id, option_number: option, sort_order: option, influencer_id: creator, creator_name: creator, revenue, revenue_egp: revenue, cost_currency: 'EGP', fx_rate_to_egp: 1, af_pct: 10, af_value: revenue / 10, af_value_egp: revenue / 10, service_description: 'Service ' + option, deliverables: [] } as unknown as QuotationItemRow);
const items = [row('one', 1, 100), row('two', 2, 200), row('three', 3, 300), row('other', 1, 900, 'inf-b')];
test('all options survive primary-line filtering and snapshot round trip without exposing costs', () => {
    const primary = quotationItemsForClient(items);
    const creators = overlayQuotationDetailOnCreators([], primary, 'EGP', 1, items);
    assert.equal(creators.length, 2);
    assert.deepEqual(creators[0].quotationOptions?.map(o => o.itemId), ['one', 'two', 'three']);
    assert.equal(creators[0].investmentAmount, 100);
    assert.deepEqual(parseSnapshotCreator(JSON.parse(JSON.stringify(creators[0]))).quotationOptions, creators[0].quotationOptions);
    assert.equal(JSON.stringify(creators[0].quotationOptions).includes('cost_'), false);
});
test('multiple choices sum only selected prices and agency fees and retain exact deliverables', () => {
    const base = quotationItemSnapshotCreator(items[0], 'EGP', 1, items);
    const selected = applyCreatorQuotationOptions({ ...base, selectedQuotationItemIds: ['two', 'three'] });
    assert.equal(selected.investmentAmount, 500);
    assert.equal(selected.agencyFeeAmount, 50);
    assert.equal(selected.serviceDescription, 'Service 2 + Service 3');
    assert.deepEqual(chosenQuotationItemIds(selected), ['two', 'three']);
    const reloaded = parseSnapshotCreator(JSON.parse(JSON.stringify(selected)));
    const refreshed = overlayQuotationDetailOnCreators([reloaded], quotationItemsForClient(items), 'EGP', 1, items);
    assert.equal(refreshed[0].investmentAmount, 500);
    assert.deepEqual(refreshed[0].selectedQuotationItemIds, ['two', 'three']);
});
test('foreign, duplicate and stale choices cannot become valid priced selections', () => {
    const base = quotationItemSnapshotCreator(items[0], 'EGP', 1, items);
    assert.equal(validateQuotationOptionChoice(base, ['other']), false);
    assert.equal(validateQuotationOptionChoice(base, ['one', 'one']), false);
    assert.equal(validateQuotationOptionChoice(base, ['two']), true);
    assert.equal(applyCreatorQuotationOptions({ ...base, selectedQuotationItemIds: ['missing'] }).investmentAmount, undefined);
    assert.equal(applyCreatorQuotationOptions({ ...base, selectedQuotationItemIds: [] }).investmentAmount, undefined);
});
test('internal selected-row actions include only exact chosen options', () => {
    const creator = quotationItemSnapshotCreator(items[0], 'EGP', 1, items);
    creator.selectedQuotationItemIds = ['two', 'three'];
    const review = { selectionState: { [creator.creatorId]: 'accepted' }, sourceSnapshot: { creators: [creator] } } as unknown as ClientReviewRecord;
    const selection = quotationOptionSelectionState(review);
    assert.deepEqual(itemIdsForClientSelection(items, selection, 'accepted'), ['two', 'three']);
});
test('alternative price changes invalidate source fingerprint; client choice does not alter source identity', () => {
    const before = quotationItemSnapshotCreator(items[0], 'EGP', 1, items);
    const changed = quotationItemSnapshotCreator(items[0], 'EGP', 1, [items[0], row('two', 2, 250), items[2]]);
    assert.notDeepEqual(fingerprintFromSnapshotCreators([before]), fingerprintFromSnapshotCreators([changed]));
    assert.deepEqual(fingerprintFromSnapshotCreators([before]), fingerprintFromSnapshotCreators([applyCreatorQuotationOptions({ ...before, selectedQuotationItemIds: ['three'] })]));
});
test('multiple approved options count as one creator and convert every chosen line', async () => {
    const { buildQuotationConvertUnits, summarizeQuotationConvertSelection } = await import('@/lib/domains/commercial/quotation-convert-selection');
    const creator = quotationItemSnapshotCreator(items[0], 'EGP', 1, items);
    creator.selectedQuotationItemIds = ['two', 'three'];
    const selection = quotationOptionSelectionState({ selectionState: { [creator.creatorId]: 'accepted' }, sourceSnapshot: { creators: [creator] } } as unknown as ClientReviewRecord);
    assert.deepEqual(countQuotationClientSelections(items, selection), { accepted: 1, inReview: 1, rejected: 0, total: 2 });
    const chosen = items.filter(item => itemIdsForClientSelection(items, selection, 'accepted').includes(item.id));
    assert.deepEqual(buildQuotationConvertUnits(chosen, { explicitSelection: true }).map(unit => unit.primaryItem.id), ['two', 'three']);
    assert.equal(summarizeQuotationConvertSelection(chosen, { explicitSelection: true }).skippedAlternativeCount, 0);
});
test('stored commercial lines and totals match multiple selected prices after reload', () => {
    const creator = applyCreatorQuotationOptions({ ...quotationItemSnapshotCreator(items[0], 'EGP', 1, items), selectedQuotationItemIds: ['two', 'three'] });
    const snapshot = reconcileQuotationOptionTotals({ creators: [creator], commercial: { currency: 'EGP' }, quotation: { lines: [] } } as unknown as import('./types').ClientReviewSourceSnapshot);
    assert.equal(snapshot.commercial.creatorInvestment, 500);
    assert.equal(snapshot.commercial.feeAmount, 50);
    assert.equal(snapshot.commercial.totalInvestment, 550);
    assert.equal(snapshot.quotation?.lines[0].amount, 500);
});
test('removing the first option does not remove the creator from client projection', () => {
    const remaining = items.slice(1, 3);
    const creators = overlayQuotationDetailOnCreators([], quotationItemsForClient(remaining), 'EGP', 1, remaining);
    assert.equal(creators.length, 1);
    assert.deepEqual(creators[0].quotationOptions?.map(option => option.optionNumber), [1, 2]);
    assert.deepEqual(creators[0].quotationOptions?.map(option => option.itemId), ['two', 'three']);
});

test('collapsed package members follow the selected option, not another alternative', () => {
 const packageItems = [ { ...row('leader', 1, 100), collapse_group_id: 'pkg' }, { ...row('follower', 1, 0), collapse_group_id: 'pkg', sort_order: 2 }, row('alternative', 2, 200) ];
 const creator = quotationItemSnapshotCreator(packageItems[0], 'EGP', 1, packageItems);
 creator.selectedQuotationItemIds = ['alternative'];
 const selection = quotationOptionSelectionState({ selectionState: { [creator.creatorId]: 'accepted' }, sourceSnapshot: { creators: [creator] } } as unknown as ClientReviewRecord);
 assert.deepEqual(itemIdsForClientSelection(packageItems, selection, 'accepted'), ['alternative']);
 creator.selectedQuotationItemIds = ['leader'];
 const packageSelection = quotationOptionSelectionState({ selectionState: { [creator.creatorId]: 'accepted' }, sourceSnapshot: { creators: [creator] } } as unknown as ClientReviewRecord);
 assert.deepEqual(itemIdsForClientSelection(packageItems, packageSelection, 'accepted'), ['leader', 'follower']);
});
