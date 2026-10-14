/** Style only: keep the canonical formatter's complete, accessible value. */
export function WorkspaceMoney({ value }: { value: string }) {
  const match = /^([A-Z]{3}) (.+)$/.exec(value);
  return match ? <><small className="cw-currency">{match[1]}</small>{" "}{match[2]}</> : <>{value}</>;
}
