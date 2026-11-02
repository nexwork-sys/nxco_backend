const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Party = require('../models/Party');
const Payment = require('../models/Payment');
const CompanySettings = require('../models/CompanySettings');
const { requireLogin, requireRole, sendJson } = require('../middleware/auth');
const { makeUploader, UPLOAD_ROOT } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
// documents[] (up to 5) + one cheque_image (only used for Credit orders).
const upload = makeUploader('documents', ['.jpg', '.jpeg', '.png', '.pdf']).fields([
    { name: 'documents', maxCount: 5 },
    { name: 'cheque_image', maxCount: 1 },
]);

// Which roles may move an order into which status — ported 1:1 from the
// PHP STATUS_PERMISSIONS map.
const STATUS_PERMISSIONS = {
    Confirmed: ['Admin', 'Supervisor', 'Manager', 'Operator'],
    'Ready to Dispatch': ['Admin', 'Supervisor', 'Manager', 'Operator'],
    'On the Way': ['Admin', 'Driver'],
    Completed: ['Admin', 'Driver'],
    Cancelled: ['Admin', 'Supervisor', 'Manager'],
};
const ORDER_STATUSES = Order.ORDER_STATUSES;
const PAYMENT_MODES = Order.PAYMENT_MODES;

// While an order is in one of these statuses its stock is still "ours" —
// deleting the order puts it back. Completed orders were delivered (stock
// is gone for good) and Cancelled ones were already restocked.
const STOCK_HELD_STATUSES = ['Pending', 'Confirmed', 'Ready to Dispatch', 'On the Way'];

const uploadedPath = f => (f ? `uploads/documents/${f.filename}` : null);

/**
 * Payment details chosen on the order: Cash, or Credit (goods now, money
 * later against a cheque — cheque number + photo required).
 * Returns { error } or { mode, chequeNo }.
 */
function parsePayment(body, { existingMode, existingChequeNo, hasChequeImage }) {
    const mode = body.payment_mode !== undefined ? body.payment_mode : existingMode || 'Cash';
    if (!PAYMENT_MODES.includes(mode)) return { error: 'Payment must be Cash or Credit.' };
    if (mode === 'Cash') return { mode, chequeNo: '' };

    const chequeNo = String(body.cheque_no !== undefined ? body.cheque_no : existingChequeNo || '').trim();
    if (!chequeNo) return { error: 'Enter the cheque number for a Credit order.' };
    if (!hasChequeImage) return { error: 'Add the cheque photo for a Credit order.' };
    return { mode, chequeNo };
}

router.use(requireLogin);

/** Validate & normalize the items array a client sends: [{product_id, quantity}]. */
function parseItems(raw) {
    let items;
    try {
        items = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
        return null;
    }
    if (!Array.isArray(items) || items.length === 0) return null;
    for (const it of items) {
        if (!it.product_id || !Number.isFinite(Number(it.quantity)) || Number(it.quantity) <= 0) return null;
    }
    return items.map(it => ({ product_id: it.product_id, quantity: Number(it.quantity) }));
}

/**
 * Attaches each item's rate from the party's Fill Form (product_rates),
 * throwing a friendly error if the party hasn't been rated for a product
 * yet — that's what gates ordering until Admin/Manager completes the
 * Fill Form for this party.
 */
function attachPartyRates(items, party) {
    const rateByProduct = new Map((party.product_rates || []).map(r => [String(r.product_id), r.rate]));
    return items.map(it => {
        const rate = rateByProduct.get(String(it.product_id));
        if (rate === undefined) {
            throw Object.assign(
                new Error(`No rate set for this product for "${party.party_name}" yet — complete the Fill Form first.`),
                { status: 422 }
            );
        }
        return { ...it, rate };
    });
}

/** Deduct stock for each item, throwing a friendly error if any product is short. Assumes a session (transaction). */
async function deductStock(items, session) {
    for (const { product_id, quantity } of items) {
        const product = await Product.findById(product_id).session(session);
        if (!product) throw Object.assign(new Error('One of the selected products no longer exists.'), { status: 404 });
        if (product.quantity < quantity) {
            throw Object.assign(
                new Error(`Not enough stock for "${product.product_name}". Available: ${product.quantity}, Ordered: ${quantity}.`),
                { status: 422 }
            );
        }
        product.quantity -= quantity;
        await product.save({ session });
    }
}

/** Deep-compare two order item arrays regardless of order, for the duplicate-submit guard. */
function itemsMatch(a, b) {
    if (a.length !== b.length) return false;
    const norm = arr => arr.map(it => `${it.product_id}:${it.quantity}`).sort().join('|');
    return norm(a) === norm(b);
}

async function restock(items, session) {
    for (const { product_id, quantity } of items) {
        await Product.findByIdAndUpdate(product_id, { $inc: { quantity } }, { session });
    }
}

// GET /api/orders?status=Pending — role-scoped visibility, newest first
router.get(
    '/',
    asyncHandler(async (req, res) => {
        const filter = {};
        if (req.user.role === 'Marketing') {
            filter.created_by = req.user._id;
        } else if (req.user.role === 'Driver') {
            filter.status = { $in: ['Ready to Dispatch', 'On the Way', 'Completed'] };
        }
        if (req.query.status) filter.status = req.query.status;

        const orders = await Order.find(filter)
            .populate('party_id', 'party_name area city address mobile lat lng')
            .populate('created_by', 'name')
            .populate('items.product_id', 'brand_name product_name rate')
            .sort({ createdAt: -1 });

        sendJson(res, true, '', { orders: orders.map(serializeOrder) });
    })
);

// GET /api/orders/:id
router.get(
    '/:id',
    asyncHandler(async (req, res) => {
        const order = await Order.findById(req.params.id)
            .populate('party_id', 'party_name area city address mobile lat lng')
            .populate('created_by', 'name')
            .populate('items.product_id', 'brand_name product_name rate');
        if (!order) return sendJson(res, false, 'Order not found.', {}, 404);
        sendJson(res, true, '', { order: serializeOrder(order) });
    })
);

function serializeOrder(o) {
    const items = o.items.map(it => ({
        product_id: it.product_id?._id ?? it.product_id,
        product_name: it.product_id?.product_name,
        brand_name: it.product_id?.brand_name,
        quantity: it.quantity,
        rate: it.rate,
        amount: it.rate * it.quantity,
    }));
    return {
        id: o._id,
        party: o.party_id,
        created_by_name: o.created_by?.name,
        items,
        total: items.reduce((sum, it) => sum + it.amount, 0),
        comment: o.comment,
        gst_no: o.gst_no,
        status: o.status,
        payment_mode: o.payment_mode || 'Cash',
        cheque_no: o.cheque_no || '',
        cheque_image: o.cheque_image || null,
        payment_collected: o.payment_collected,
        amount_collected: o.amount_collected,
        payment_method: o.payment_method,
        documents: o.documents,
        created_at: o.createdAt,
    };
}

// GET /api/orders/:id/invoice — a downloadable PDF invoice: which party,
// which products/quantities, and the total order value. Admin can pull
// this for any order; Marketing only for orders they placed themselves.
router.get(
    '/:id/invoice',
    asyncHandler(async (req, res) => {
        const order = await Order.findById(req.params.id)
            .populate('party_id', 'party_name area city address mobile gst_no')
            .populate('created_by', 'name employee_id')
            .populate('items.product_id', 'brand_name product_name');
        if (!order) return sendJson(res, false, 'Order not found.', {}, 404);
        if (req.user.role === 'Marketing' && String(order.created_by?._id) !== String(req.user._id)) {
            return sendJson(res, false, 'You can only download invoices for your own orders.', {}, 403);
        }

        const o = serializeOrder(order);
        const companyName = process.env.COMPANY_NAME || 'NXCO';
        const invoiceNo = `INV-${String(order._id).slice(-8).toUpperCase()}`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${invoiceNo}.pdf"`);

        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        doc.pipe(res);

        // Header
        doc.fontSize(18).font('Helvetica-Bold').text(companyName, { align: 'left' });
        doc.fontSize(10).font('Helvetica').fillColor('#555').text('Order Invoice', { align: 'left' });
        doc.moveDown(0.5);
        doc.fillColor('#000');

        const headerTop = doc.y;
        doc.fontSize(10).font('Helvetica-Bold').text(`Invoice No: `, 40, headerTop, { continued: true }).font('Helvetica').text(invoiceNo);
        doc.font('Helvetica-Bold').text(`Order Date: `, { continued: true }).font('Helvetica').text(new Date(order.createdAt).toLocaleString('en-IN'));
        doc.font('Helvetica-Bold').text(`Status: `, { continued: true }).font('Helvetica').text(order.status);
        doc.font('Helvetica-Bold').text(`Placed By: `, { continued: true }).font('Helvetica').text(order.created_by?.name || '-');
        doc.font('Helvetica-Bold').text(`Payment: `, { continued: true }).font('Helvetica').text(
            o.payment_mode === 'Credit' ? `Credit (pay later) - Cheque No: ${o.cheque_no || '-'}` : 'Cash'
        );
        doc.moveDown(0.8);

        // Party (Bill To)
        doc.font('Helvetica-Bold').fontSize(11).text('Bill To / Party Details');
        doc.moveTo(40, doc.y + 2).lineTo(555, doc.y + 2).strokeColor('#ccc').stroke();
        doc.moveDown(0.4);
        const party = order.party_id;
        doc.font('Helvetica-Bold').fontSize(10).text(party?.party_name || '-');
        doc.font('Helvetica').fontSize(9.5).fillColor('#333');
        if (party?.address) doc.text(party.address);
        const locLine = [party?.area, party?.city].filter(Boolean).join(', ');
        if (locLine) doc.text(locLine);
        if (party?.mobile) doc.text(`Mobile: ${party.mobile}`);
        if (order.gst_no || party?.gst_no) doc.text(`GSTIN: ${order.gst_no || party.gst_no}`);
        doc.fillColor('#000');
        doc.moveDown(1);

        // Items table
        const tableTop = doc.y;
        const cols = { sr: 40, name: 75, qty: 340, rate: 400, amount: 470 };
        doc.font('Helvetica-Bold').fontSize(9.5);
        doc.text('Sr', cols.sr, tableTop);
        doc.text('Product', cols.name, tableTop);
        doc.text('Qty', cols.qty, tableTop, { width: 50, align: 'right' });
        doc.text('Rate', cols.rate, tableTop, { width: 60, align: 'right' });
        doc.text('Amount', cols.amount, tableTop, { width: 85, align: 'right' });
        doc.moveTo(40, tableTop + 14).lineTo(555, tableTop + 14).strokeColor('#000').stroke();

        let y = tableTop + 20;
        doc.font('Helvetica').fontSize(9.5);
        o.items.forEach((it, idx) => {
            const label = [it.brand_name, it.product_name].filter(Boolean).join(' — ') || 'Product';
            doc.text(String(idx + 1), cols.sr, y);
            doc.text(label, cols.name, y, { width: 260 });
            doc.text(String(it.quantity), cols.qty, y, { width: 50, align: 'right' });
            doc.text(it.rate.toFixed(2), cols.rate, y, { width: 60, align: 'right' });
            doc.text(it.amount.toFixed(2), cols.amount, y, { width: 85, align: 'right' });
            y += 18;
        });
        doc.moveTo(40, y + 2).lineTo(555, y + 2).strokeColor('#ccc').stroke();
        y += 12;
        doc.font('Helvetica-Bold').fontSize(11).text('Total', cols.rate, y, { width: 60, align: 'right' });
        doc.text(`Rs. ${o.total.toFixed(2)}`, cols.amount, y, { width: 85, align: 'right' });

        if (order.comment) {
            doc.moveDown(2);
            doc.font('Helvetica-Bold').fontSize(9.5).text('Comment:', 40);
            doc.font('Helvetica').text(order.comment, 40, doc.y, { width: 500 });
        }

        doc.moveDown(2);
        doc.font('Helvetica').fontSize(8).fillColor('#888').text(
            `Generated on ${new Date().toLocaleString('en-IN')}`,
            40
        );

        doc.end();
    })
);

// POST /api/orders — Marketing places a new order (multipart, may include documents[]).
//   payment_mode ('Cash' | 'Credit'; default Cash),
//   cheque_no + cheque_image — required when payment_mode is 'Credit'.
router.post(
    '/',
    requireRole('Marketing', 'Admin'),
    upload,
    asyncHandler(async (req, res) => {
        const { party_id, comment, gst_no } = req.body || {};
        const items = parseItems(req.body?.products_json ?? req.body?.items);
        if (!party_id || !items) {
            return sendJson(res, false, 'Select a party and at least one product with a valid quantity.', {}, 422);
        }
        const party = await Party.findById(party_id);
        if (!party) return sendJson(res, false, 'Party not found.', {}, 404);

        const chequeFile = req.files?.cheque_image?.[0];
        const payment = parsePayment(req.body || {}, { hasChequeImage: !!chequeFile });
        if (payment.error) return sendJson(res, false, payment.error, {}, 422);

        // Server-side duplicate-submission guard: if this exact user placed
        // an identical order (same party + same items) in the last 10
        // seconds, treat it as a double-tap/retry rather than a new order —
        // this is the backstop for the "order saved twice" bug regardless
        // of what causes the double request (slow network, client retry,
        // fast double-tap racing past the button's disabled state, etc).
        const tenSecondsAgo = new Date(Date.now() - 10_000);
        const recentDuplicate = await Order.findOne({
            created_by: req.user._id,
            party_id,
            comment: comment || '',
            createdAt: { $gte: tenSecondsAgo },
        }).sort({ createdAt: -1 });
        if (recentDuplicate && itemsMatch(recentDuplicate.items, items)) {
            return sendJson(res, true, 'Order placed.', { id: recentDuplicate._id, deduped: true });
        }

        const session = await mongoose.startSession();
        try {
            let order;
            await session.withTransaction(async () => {
                const ratedItems = attachPartyRates(items, party);
                await deductStock(ratedItems, session);
                order = (
                    await Order.create(
                        [
                            {
                                party_id,
                                created_by: req.user._id,
                                items: ratedItems,
                                comment: comment || '',
                                gst_no: gst_no || '',
                                payment_mode: payment.mode,
                                cheque_no: payment.chequeNo,
                                cheque_image: payment.mode === 'Credit' ? uploadedPath(chequeFile) : null,
                                documents: (req.files?.documents || []).map(uploadedPath),
                            },
                        ],
                        { session }
                    )
                )[0];
            });
            sendJson(res, true, 'Order placed.', { id: order._id });
        } catch (e) {
            sendJson(res, false, e.message || 'Could not place order.', {}, e.status || 500);
        } finally {
            session.endSession();
        }
    })
);

// POST /api/orders/:id/update — only while Pending, and only by whoever placed it or Admin
router.post(
    '/:id/update',
    requireRole('Marketing', 'Admin'),
    upload,
    asyncHandler(async (req, res) => {
        const order = await Order.findById(req.params.id);
        if (!order) return sendJson(res, false, 'Order not found.', {}, 404);
        if (order.status !== 'Pending') {
            return sendJson(res, false, 'Only Pending orders can be edited.', {}, 409);
        }
        if (req.user.role === 'Marketing' && String(order.created_by) !== String(req.user._id)) {
            return sendJson(res, false, 'You can only edit your own orders.', {}, 403);
        }

        const newItems = parseItems(req.body?.products_json ?? req.body?.items);

        // Payment choice (Cash/Credit + cheque) can be changed while Pending.
        const chequeFile = req.files?.cheque_image?.[0];
        const payment = parsePayment(req.body || {}, {
            existingMode: order.payment_mode,
            existingChequeNo: order.cheque_no,
            hasChequeImage: !!chequeFile || !!order.cheque_image,
        });
        if (payment.error) return sendJson(res, false, payment.error, {}, 422);
        // Cash orders carry no cheque; Credit keeps the old photo unless a new one was sent.
        const finalChequeImage = payment.mode === 'Cash' ? null : uploadedPath(chequeFile) || order.cheque_image;

        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                if (newItems) {
                    const party = await Party.findById(order.party_id).session(session);
                    if (!party) throw Object.assign(new Error('Party not found.'), { status: 404 });
                    const ratedItems = attachPartyRates(newItems, party);
                    // Return old stock, then deduct the new quantities — keeps
                    // stock accurate even if the product list itself changed.
                    await restock(order.items, session);
                    await deductStock(ratedItems, session);
                    order.items = ratedItems;
                }
                if (req.body.comment !== undefined) order.comment = req.body.comment;
                if (req.body.gst_no !== undefined) order.gst_no = req.body.gst_no;
                order.payment_mode = payment.mode;
                order.cheque_no = payment.chequeNo;
                order.cheque_image = finalChequeImage;
                await order.save({ session });
            });
            sendJson(res, true, 'Order updated.');
        } catch (e) {
            sendJson(res, false, e.message || 'Could not update order.', {}, e.status || 500);
        } finally {
            session.endSession();
        }
    })
);

// POST /api/orders/:id/delete
//   Admin     — can delete an order in ANY status (Overview / All Orders screens).
//   Marketing — only their own order, and only while it is still Pending.
// Deleting removes the order completely, including every payment entry
// recorded against it, so the party's billed / due figures and the
// employee's target progress no longer count it. Stock goes back to
// inventory unless the order was already delivered (Completed) or
// Cancelled (restocked at cancel time).
router.post(
    '/:id/delete',
    requireRole('Marketing', 'Admin'),
    asyncHandler(async (req, res) => {
        const order = await Order.findById(req.params.id);
        if (!order) return sendJson(res, false, 'Order not found.', {}, 404);

        const isAdmin = req.user.role === 'Admin';
        if (!isAdmin) {
            if (String(order.created_by) !== String(req.user._id)) {
                return sendJson(res, false, 'You can only delete your own orders.', {}, 403);
            }
            if (order.status !== 'Pending') {
                return sendJson(res, false, 'Only Pending orders can be deleted.', {}, 409);
            }
        }

        const session = await mongoose.startSession();
        try {
            let stockReturned = false;
            await session.withTransaction(async () => {
                stockReturned = STOCK_HELD_STATUSES.includes(order.status);
                if (stockReturned) await restock(order.items, session);
                await Payment.deleteMany({ order_id: order._id }, { session });
                await order.deleteOne({ session });
            });

            // Best-effort cleanup of the order's uploaded files.
            for (const rel of [...(order.documents || []), order.cheque_image].filter(Boolean)) {
                fs.promises.unlink(path.join(UPLOAD_ROOT, '..', rel)).catch(() => {});
            }
            sendJson(res, true, 'Order deleted.', { stock_returned: stockReturned });
        } finally {
            session.endSession();
        }
    })
);

// POST /api/orders/:id/status  { status, payment_collected?, amount_collected?, payment_method? }
// When a Driver/Admin marks an order Completed with payment_collected=true,
// amount_collected (Rupees) and payment_method ('Cash'|'Online') are
// required — this is what lets Admin/Marketing see exactly how much a
// driver took in the field, vs how much is still due from the party.
router.post(
    '/:id/status',
    asyncHandler(async (req, res) => {
        const newStatus = req.body?.status;
        if (!ORDER_STATUSES.includes(newStatus)) {
            return sendJson(res, false, 'Invalid status value.', {}, 422);
        }
        const allowedRoles = STATUS_PERMISSIONS[newStatus] || ['Admin'];
        if (!allowedRoles.includes(req.user.role)) {
            return sendJson(res, false, 'You are not permitted to set this status.', {}, 403);
        }

        const order = await Order.findById(req.params.id);
        if (!order) return sendJson(res, false, 'Order not found.', {}, 404);

        // Validate the payment fields up front (outside the transaction)
        // so a bad request never touches stock/status at all.
        let paymentToRecord = null;
        if (newStatus === 'Completed' && req.body.payment_collected !== undefined) {
            const collected = !!req.body.payment_collected;
            if (collected) {
                const amount = Number(req.body.amount_collected);
                const method = req.body.payment_method;
                if (!Number.isFinite(amount) || amount <= 0) {
                    return sendJson(res, false, 'Enter how much was collected.', {}, 422);
                }
                if (!['Cash', 'Online'].includes(method)) {
                    return sendJson(res, false, 'Select Cash or Online.', {}, 422);
                }
                paymentToRecord = { amount, method };
            }
        }

        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                // Cancelling returns stock — but only once, so re-saving an
                // already-Cancelled order doesn't double-restock.
                if (newStatus === 'Cancelled' && order.status !== 'Cancelled') {
                    await restock(order.items, session);
                }
                order.status = newStatus;
                if (newStatus === 'Completed' && req.body.payment_collected !== undefined) {
                    order.payment_collected = !!req.body.payment_collected;
                    order.amount_collected = paymentToRecord ? paymentToRecord.amount : null;
                    order.payment_method = paymentToRecord ? paymentToRecord.method : null;

                    // One Payment ledger entry per order — re-completing an
                    // already-Completed order (e.g. re-tap, or correcting
                    // the amount) shouldn't double it up, so clear any
                    // earlier entry for this order first. Scoped to this
                    // branch only, so unrelated status changes (Cancelled,
                    // On the Way, etc) never touch an order's payment record.
                    await Payment.deleteMany({ order_id: order._id }, { session });
                    if (paymentToRecord) {
                        await Payment.create(
                            [
                                {
                                    party_id: order.party_id,
                                    order_id: order._id,
                                    amount: paymentToRecord.amount,
                                    method: paymentToRecord.method,
                                    collected_by: req.user._id,
                                    note: 'Collected on delivery',
                                },
                            ],
                            { session }
                        );
                    }
                }
                await order.save({ session });
            });
            sendJson(res, true, `Order status updated to "${newStatus}".`);
        } finally {
            session.endSession();
        }
    })
);

module.exports = router;
