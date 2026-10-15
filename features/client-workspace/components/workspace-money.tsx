/** Style only: keep the canonical formatter's complete, accessible value. */
export function WorkspaceMoney({ value }: { value: string }) {
  const match = /^([A-Z]{3}) (.+)$/.exec(value);
  if (!match) return <>{value}</>;
  const amount = <><small className="cw-currency">{match[1]}</small>{" "}{match[2]}</>;
  // Style an explicitly formatted zero without changing the amount or formatter.
  return /^0(?:[.,]0+)?$/.test(match[2]) ? <span className="cw-money-zero">{amount}</span> : amount;
}
