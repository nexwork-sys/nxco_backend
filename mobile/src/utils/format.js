/** Today's date in IST as 'YYYY-MM-DD' — mirrors the backend's todayIST(), for defaulting date filters/pickers. */
export function todayIST() {
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Formats an ISO datetime string (e.g. a Mongo `updatedAt`) as IST date + time, e.g. "29 Aug, 3:45 PM". */
export function formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

/** Formats a rupee amount as e.g. "₹1,250" — no decimals for whole rupees, otherwise 2dp. */
export function formatMoney(amount) {
    const n = Number(amount) || 0;
    const opts = Number.isInteger(n) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    return `₹${n.toLocaleString('en-IN', opts)}`;
}

/** Formats a 'YYYY-MM-DD' date string (already IST, straight from the backend) as e.g. "29 Aug 2026". */
export function formatDateStr(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d} ${months[Number(m) - 1]} ${y}`;
}
