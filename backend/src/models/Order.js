const mongoose = require('mongoose');

const PAYMENT_MODES = ['Cash', 'Credit'];
const ORDER_STATUSES = ['Pending', 'Confirmed', 'Ready to Dispatch', 'On the Way', 'Completed', 'Cancelled'];

const orderItemSchema = new mongoose.Schema(
    {
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1 },
        // Snapshot of this party's negotiated rate for this product at the
        // time the order was placed (from Party.product_rates via the Fill
        // Form) — kept even if the rate is renegotiated later.
        rate: { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        party_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        items: { type: [orderItemSchema], required: true, validate: v => v.length > 0 },
        comment: { type: String, default: '' },
        documents: { type: [String], default: [] }, // relative upload paths
        gst_no: { type: String, default: '' },
        status: { type: String, enum: ORDER_STATUSES, default: 'Pending' },
        // Chosen when the order is placed: Cash, or Credit (goods now, money
        // later against a cheque — cheque number + photo required).
        payment_mode: { type: String, enum: PAYMENT_MODES, default: 'Cash' },
        cheque_no: { type: String, default: '' },
        cheque_image: { type: String, default: null }, // relative path under /uploads
        payment_collected: { type: Boolean, default: null },
        // Set together with payment_collected when a Driver/Admin marks the
        // order Completed with money in hand — how much, and Cash vs
        // Online. A matching Payment ledger entry is created at the same
        // time, which is what actually drives the party's "due" figure.
        amount_collected: { type: Number, default: null },
        payment_method: { type: String, enum: ['Cash', 'Online'], default: null },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
module.exports.PAYMENT_MODES = PAYMENT_MODES;
