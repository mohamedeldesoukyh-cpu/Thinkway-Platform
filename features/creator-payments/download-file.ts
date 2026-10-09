import { PAYMENT_FILENAME, paymentFileBytes } from './aaib';

/** Browser download shared by exports and editors; keep this module free of UI imports. */
export function downloadFile(data: string, name: string, type: string, base64 = false) {
    const bytes = base64 ? Uint8Array.from(atob(data), c => c.charCodeAt(0)) : name === PAYMENT_FILENAME ? paymentFileBytes(data) : data;
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
