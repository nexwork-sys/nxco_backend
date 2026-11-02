const mongoose = require('mongoose');
const express = require('express');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Party = require('../models/Party');
const { requireLogin, requireRole, sendJson } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireLogin);

/** Sum of item (rate * quantity) across a party's Completed orders — the total value ever billed to them. */
async function totalBilledByParty() {
    const rows = await Order.aggregate([
        { $match: { status: 'Completed' } },
        { $unwind: '$items' },
        {
            $group: {
                _id: '$party_id',
                billed: { $sum: { $multiply: ['$items.rate', '$items.quantity'] } },
            },
        },
    ]);
    const map = new Map();
    rows.forEach(r => map.set(String(r._id), r.billed));
    return map;
}

/** Sum of every Payment (driver-collected + manual) recorded against a party. */
async function totalCollectedByParty() {
    const rows = await Payment.aggregate([{ $group: { _id: '$party_id', collected: { $sum: '$amount' } } }]);
    const map = new Map();
    rows.forEach(r => map.set(String(r._id), r.collected));
    return map;
}

// GET /api/payments/dues — every party's billed / collected / due, for the
// Admin & Marketing Party Dashboard "due" badges. Newest-due-first isn't
// applied here — the client sorts/filters as it already does for parties.
router.get(
    '/dues',
    asyncHandler(async (req, res) => {
        const [billedMap, collectedMap, parties] = await Promise.all([
            totalBilledByParty(),
            totalCollectedByParty(),
            Party.find().select('party_name'),
        ]);
        const dues = parties.map(p => {
            const billed = billedMap.get(String(p._id)) || 0;
            const collected = collectedMap.get(String(p._id)) || 0;
            return {
                party_id: p._id,
                billed,
                collected,
                due: Math.max(0, Math.round((billed - collected) * 100) / 100),
            };
        });
        sendJson(res, true, '', { dues });
    })
);

// GET /api/payments/party/:partyId — one party's due summary + full payment history, newest first.
router.get(
    '/party/:partyId',
    asyncHandler(async (req, res) => {
        const party = await Party.findById(req.params.partyId).select('party_name');
        if (!party) return sendJson(res, false, 'Party not found.', {}, 404);

        const [billedMap, payments] = await Promise.all([
            totalBilledByParty(),
            Payment.find({ party_id: req.params.partyId })
                .populate('collected_by', 'name')
                .populate('order_id', 'createdAt')
                .sort({ createdAt: -1 }),
        ]);
        const billed = billedMap.get(String(party._id)) || 0;
        const collected = payments.reduce((sum, p) => sum + p.amount, 0);

        sendJson(res, true, '', {
            billed,
            collected,
            due: Math.max(0, Math.round((billed - collected) * 100) / 100),
            payments: payments.map(p => ({
                id: p._id,
                amount: p.amount,
                method: p.method,
                note: p.note,
                order_id: p.order_id?._id ?? null,
                collected_by_name: p.collected_by?.name || '—',
                created_at: p.createdAt,
            })),
        });
    })
);

// POST /api/payments — a manual collection entry against a party's running
// due (party paid cash at the office, over UPI, cleared old due, etc — not
// tied to marking a specific delivery Completed, which records its own
// payment automatically via /api/orders/:id/status).
router.post(
    '/',
    requireRole('Admin', 'Marketing', 'Manager'),
    asyncHandler(async (req, res) => {
        const { party_id, amount, method, note } = req.body || {};
        const party = await Party.findById(party_id);
        if (!party) return sendJson(res, false, 'Party not found.', {}, 404);

        const numAmount = Number(amount);
        if (!Number.isFinite(numAmount) || numAmount <= 0) {
            return sendJson(res, false, 'Enter a valid payment amount.', {}, 422);
        }
        if (!['Cash', 'Online'].includes(method)) {
            return sendJson(res, false, 'Select a payment method.', {}, 422);
        }

        const payment = await Payment.create({
            party_id,
            amount: numAmount,
            method,
            note: note || '',
            collected_by: req.user._id,
        });
        sendJson(res, true, 'Payment recorded.', { id: payment._id });
    })
);

module.exports = router;
