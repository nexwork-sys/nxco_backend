/** Order items come back from the API already populated with product_name/brand_name. */
export function orderItemsSummary(order) {
    if (!order?.items?.length) return '—';
    return order.items.map(it => `${it.quantity} × ${it.brand_name ?? ''} ${it.product_name ?? ''}`.trim()).join(', ');
}

export function mapsDirectionsUrl(lat, lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function mapsSearchUrl(lat, lng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

const STOCK_HELD = ['Pending', 'Confirmed', 'Ready to Dispatch', 'On the Way'];

/** Confirmation text for Admin deleting an order in ANY status — says exactly what will happen. */
export function deleteOrderMessage(order) {
    const who = order.party?.party_name || 'this party';
    if (STOCK_HELD.includes(order.status)) {
        return `Order for ${who} will be removed completely and its stock returned to inventory.`;
    }
    if (order.status === 'Completed') {
        return `Order for ${who} will be removed completely, along with its payment entries (the party's due is recalculated). Stock is NOT returned because it was already delivered.`;
    }
    return `Order for ${who} will be removed completely (its stock was already returned when it was cancelled).`;
}
