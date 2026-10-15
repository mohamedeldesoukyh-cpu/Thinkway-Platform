import { WorkspaceMoney } from './workspace-money';
import { formatMoneyKpi } from '@/lib/finance/currency-format';
import { PRICE_PENDING_LABEL } from '../selection-flow';
import { clientFacingCreatorCardAmount, originalClientFacingCreatorCardAmount, visibleOriginalCurrencyAmount } from '../quotation-client-facing';
import type { ClientCreatorCard } from '../types';

/** Presentation of existing client-facing amounts; never accepts internal cost fields. */
export function CreatorInvestment({ creator, currency, hideCostAndFees, showOriginalCurrency, isSelected }: {
  creator: ClientCreatorCard;
  isSelected: boolean;
  currency: string;
  hideCostAndFees: boolean;
  showOriginalCurrency: boolean;
}) {
  // Quoted options remain available separately; this is the selection summary.
  if (!isSelected) {
    return <span className="inv tbc">
      <span className="cw-money-row cw-money-investment"><span>{hideCostAndFees ? 'Total investment' : 'Investment'}</span>
        <strong>Nothing selected</strong>
      </span>
    </span>;
  }
  const total = clientFacingCreatorCardAmount(creator);
  const fees = creator.agencyFeeAmount ?? 0;
  const investment = total == null ? total : hideCostAndFees ? total : total - fees;
  const original = visibleOriginalCurrencyAmount(
    originalClientFacingCreatorCardAmount(creator, currency), showOriginalCurrency,
  );
  return (
    <span className={total != null ? 'inv' : 'inv tbc'}>
      <span className="cw-money-row cw-money-investment"><span>{hideCostAndFees ? 'Total investment' : 'Investment'}</span>
      <strong>{investment != null ? <WorkspaceMoney value={formatMoneyKpi(investment, currency)} /> : PRICE_PENDING_LABEL}</strong></span>
      {!hideCostAndFees && total != null ? <>
        <span className="cw-money-row"><span>Agency fees</span><strong>{<WorkspaceMoney value={formatMoneyKpi(fees, currency)} />}</strong></span>
        <span className="cw-money-row cw-money-total"><span>Total investment</span><strong>{<WorkspaceMoney value={formatMoneyKpi(total, currency)} />}</strong></span>
      </> : null}
      {original ? <span className="inv-orig">Original: {formatMoneyKpi(original.amount, original.currency)}</span> : null}
    </span>
  );
}
