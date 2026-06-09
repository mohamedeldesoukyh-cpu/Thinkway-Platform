export function formatPortalCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatPortalDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export function formatPortalDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "—";
}
