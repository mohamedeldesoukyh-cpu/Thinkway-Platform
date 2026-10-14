import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreatorInvestment } from './components/creator-investment';
import { PRICE_PENDING_LABEL } from './selection-flow';
import type { ClientCreatorCard } from './types';
const creator = { creatorId:'fixture', investmentAmount:120000, agencyFeeAmount:12000, investmentCurrency:'EGP' } as ClientCreatorCard;
function render(value:ClientCreatorCard, hidden=false, original=false) {
  return renderToStaticMarkup(<CreatorInvestment creator={value} currency="EGP" hideCostAndFees={hidden} showOriginalCurrency={original} />);
}
test('card presents investment, fee and total from the existing amount calculation', () => {
  const html=render(creator);
  assert.match(html,/120,000/); assert.match(html,/12,000/); assert.match(html,/132,000/);
  assert.match(html,/Agency fees/); assert.match(html,/Total investment/);
});
test('hidden fee setting only exposes the combined total', () => {
  const html=render(creator,true);
  assert.match(html,/132,000/); assert.doesNotMatch(html,/Agency fees|120,000|12,000/);
});
test('unpriced card does not claim a zero fee or total', () => {
  const html=render({...creator,investmentAmount:undefined});
  assert.ok(html.includes(PRICE_PENDING_LABEL));
  assert.doesNotMatch(html,/Agency fees|cw-money-total/);
});
test('original-currency amounts are opt-in and never relabelled', () => {
  const value={...creator,originalInvestmentAmount:2400,originalInvestmentCurrency:'USD'};
  assert.doesNotMatch(render(value),/USD|2,400|Original:/);
  assert.match(render(value,false,true),/Original:.*2,640.*USD|Original:.*USD.*2,640/);
});
