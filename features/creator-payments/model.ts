export type BankDetails = {
    payment_type: string;
    currency: string;
    nickname: string;
    beneficiary_name: string;
    account_number: string;
    iban: string;
    beneficiary_address: string;
    email: string;
    mobile: string;
    country: string;
    swift: string;
    identifier: string;
    clearing_code: string;
    bank_name: string;
    bank_address: string;
    bank_branch: string;
    registered: boolean;
};
export type PaymentRow = {
    units?: import('./allocations').PaymentUnit[];
    history?: PaymentEntry[];
    savedDraft?: PaymentDraft;
    assignmentId: string;
    campaignId: string;
    creatorId: string;
    creator: string;
    username?: string;
    campaign?: string;
    payable?: boolean;
    ioId: string;
    ioNumber: string;
    ioStatus: string;
    currency: string;
    fee: number;
    vat: number;
    paid: number;
    reserved: number;
    bank: BankDetails;
};
export type PaymentDraft = {
    paymentDate?: string;
    fee: number;
    vat: number;
    currency: string;
    rate: number;
    mode: string;
    percent: number;
    amount: number;
    invoiceNumber?: string;
    invoiceDate?: string;
    invoiceAmount?: number;
};
export type PaymentEntry = {
    payment_date?: string | null;
    payment_sequence?: number | null;
    source?: string;
    created_at?: string;
    id: string;
    batch_id: string | null;
    assignment_id: string;
    creator_name: string;
    original_currency: string;
    original_amount: number;
    payment_currency: string;
    payment_amount: number;
    status: string;
    bank_reference: string | null;
};
export type PaymentBatch = {
    id: string;
    created_at: string;
    transfer_date: string;
    entries: PaymentEntry[];
};
export const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function calculatePayment(row: PaymentRow, draft: PaymentDraft) {
    const fee = money(draft.fee);
    const vatAmount = money(fee * draft.vat / 100);
    const total = money(fee + vatAmount);
    const outstanding = money(Math.max(0, total - row.paid));
    const available = money(Math.max(0, outstanding - row.reserved));
    const rate = draft.currency === row.currency ? 1 : draft.rate;
    const requestedOriginal = draft.mode === "full" ? available : draft.mode === "manual"
        ? money(draft.amount / rate) : money(total * draft.percent / 100);
    const payNow = draft.mode === "manual" ? money(draft.amount) : money(requestedOriginal * rate);
    const originalPay = money(payNow / rate);
    const errors: string[] = [];
    if (!Number.isFinite(fee) || fee < 0)
        errors.push("Agreed fee must be zero or more.");
    if (!Number.isFinite(draft.vat) || draft.vat < 0 || draft.vat > 100)
        errors.push("VAT must be between 0 and 100%.");
    if (!Number.isFinite(rate) || rate <= 0)
        errors.push("Enter a positive exchange rate.");
    if (!Number.isFinite(payNow) || payNow <= 0)
        errors.push("Pay now must be greater than zero.");
    if (originalPay <= 0)
        errors.push("Payment is below the original currency rounding precision.");
    if (row.paid + row.reserved > total)
        errors.push("Total creator fees cannot be below paid and pending amounts.");
    if (row.reserved > 0 && (fee !== row.fee || draft.vat !== row.vat))
        errors.push("Confirm pending bank results before changing fees or VAT.");
    if (originalPay > available + 0.005)
        errors.push("Pay now exceeds the available balance, including pending exports.");
    return { fee, vatAmount, total, outstanding, available, rate, originalPay, payNow,
        remaining: money(available - originalPay), errors };
}
export function paymentStatus(paid: number, total: number) {
    if (paid <= 0)
        return { label: "Unpaid", className: "bg-red-50 text-red-700" };
    if (money(total - paid) <= 0)
        return { label: "Fully paid", className: "bg-green-50 text-green-700" };
    return { label: "Partially paid", className: "bg-orange-50 text-orange-700" };
}
export function ioBadge(status: string) {
    if (status === "approved" || status === "signed")
        return { label: "IO approved", className: "bg-green-50 text-green-700" };
    if (["rejected", "cancelled", "void", "voided", "superseded"].includes(status))
        return { label: `IO ${status}`, className: "bg-red-50 text-red-700" };
    return { label: `IO pending · ${status.replaceAll("_", " ")}`, className: "bg-amber-50 text-amber-800" };
}
export function bankDetails(value: Record<string, unknown> = {}): BankDetails {
    const text = (key: string) => typeof value[key] === "string" ? (value[key] as string) : "";
    return { payment_type: text("aaib_payment_type"), currency: text("aaib_currency"), nickname: text("aaib_nickname"),
        beneficiary_name: text("beneficiary_name"), account_number: text("account_number"), iban: text("iban"),
        beneficiary_address: text("aaib_address"), email: text("aaib_email"), mobile: text("aaib_mobile"),
        country: text("aaib_country"), swift: text("swift"), identifier: text("aaib_identifier"), clearing_code: text("aaib_clearing_code"),
        bank_name: text("bank_name"), bank_address: text("aaib_bank_address"), bank_branch: text("bank_branch"),
        registered: value.aaib_registered === true };
}
