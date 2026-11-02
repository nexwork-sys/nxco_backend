const mongoose = require('mongoose');

// Every payment collected against a party — either automatically recorded
// when a Driver/Admin marks a delivery Completed with money collected, or
// a manual entry Admin/Marketing adds later (e.g. party paid cash at the
// office, or over UPI, against their running due). Party's "due" is always
// derived as (sum of Completed order values) - (sum of Payment amounts),
// never stored directly, so it can never drift out of sync.
const PAYMENT_METHODS = ['Cash', 'Online'];

const paymentSchema = new mongoose.Schema(
    {
        party_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
        // Set when this payment was collected at the moment a specific
        // delivery was marked Completed; null for a manual entry not tied
        // to one particular order (e.g. "party cleared ₹2000 of old due").
        order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
        amount: { type: Number, required: true, min: 0.01 },
        method: { type: String, enum: PAYMENT_METHODS, required: true },
        collected_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        note: { type: String, default: '' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
