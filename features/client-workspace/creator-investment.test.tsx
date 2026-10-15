import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreatorInvestment } from './components/creator-investment';
import { applyCreatorQuotationOptions } from './quotation-options';
import { PRICE_PENDING_LABEL } from './selection-flow';
import type { ClientCreatorCard } from './types';
const creator = { creatorId:'fixture', investmentAmount:120000, agencyFeeAmount:12000, investmentCurrency:'EGP' } as ClientCreatorCard;
function render(value:ClientCreatorCard, hidden=false, original=false, selected=true) {
  return renderToStaticMarkup(<CreatorInvestment creator={value} isSelected={selected} currency="EGP" hideCostAndFees={hidden} showOriginalCurrency={original} />);
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


test('unselected summary never displays the quoted price, fees or original currency', () => {
  const value = {...creator, originalInvestmentAmount:2400, originalInvestmentCurrency:'USD'};
  for (const hidden of [false, true]) {
    const html = render(value, hidden, true, false);
    assert.match(html, /Nothing selected/);
    assert.doesNotMatch(html, /120,000|12,000|132,000|Original:|USD|Agency fees/);
  }
  assert.equal(value.investmentAmount, 120000);
});

test('an unselected unpriced creator is not mistaken for a pending selected investment', () => {
  const html = render({...creator, investmentAmount:undefined}, false, false, false);
  assert.match(html, /Nothing selected/);
  assert.ok(!html.includes(PRICE_PENDING_LABEL));
});

test('selection summary follows chosen options and returns to empty when the last is removed', () => {
  const value = {...creator, quotationOptions:[
    {itemId:'one', optionNumber:1, investmentAmount:100000, agencyFeeAmount:10000},
    {itemId:'two', optionNumber:2, investmentAmount:20000, agencyFeeAmount:2000},
    {itemId:'unused', optionNumber:3, investmentAmount:999000, agencyFeeAmount:99900},
  ]};
  const selected = applyCreatorQuotationOptions({...value, selectedQuotationItemIds:['one','two']});
  const html = render(selected);
  assert.match(html, /120,000/);
  assert.match(html, /12,000/);
  assert.match(html, /132,000/);
  assert.doesNotMatch(html, /999,000|Nothing selected/);
  const empty = applyCreatorQuotationOptions({...selected, selectedQuotationItemIds:[]});
  assert.match(render(empty, false, false, false), /Nothing selected/);
  assert.deepEqual(empty.quotationOptions, value.quotationOptions);
});
