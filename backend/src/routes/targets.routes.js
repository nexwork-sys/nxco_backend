const express = require('express');
const Target = require('../models/Target');
const Order = require('../models/Order');
const User = require('../models/User');
const { requireLogin, requireRole, sendJson } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { todayIST } = require('../utils/dateIST');

const router = express.Router();
router.use(requireLogin);

/** 'YYYY-MM-DD' (IST) -> real Date range covering that whole IST day, for createdAt queries. */
function istDateRange(startStr, endStr) {
    return {
        $gte: new Date(`${startStr}T00:00:00+05:30`),
        $lte: new Date(`${endStr}T23:59:59.999+05:30`),
    };
}

/**
 * Achieved quantity = total units ordered by this employee inside the
 * target window. Counts as soon as the order is placed (even Pending) —
 * only Cancelled orders don't count, since their stock was returned.
 */
async function achievedQuantity(userId, start_date, end_date) {
    const orders = await Order.find({
        created_by: userId,
        status: { $ne: 'Cancelled' },
        createdAt: istDateRange(start_date, end_date),
    }).select('items');
    return orders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0), 0);
}

function daysLeft(end_date) {
    const today = todayIST();
    const diff = Math.ceil((new Date(`${end_date}T00:00:00+05:30`) - new Date(`${today}T00:00:00+05:30`)) / 86400000);
    return diff;
}

function serialize(t, achieved) {
    const quantity_target = t.quantity_target;
    const remaining = Math.max(0, quantity_target - achieved);
    return {
        id: t._id,
        assigned_to: t.assigned_to?._id ?? t.assigned_to,
        employee_name: t.assigned_to?.name,
        employee_id: t.assigned_to?.employee_id,
        month: t.month,
        quantity_target,
        start_date: t.start_date,
        end_date: t.end_date,
        notes: t.notes,
        achieved,
        remaining,
        percent: quantity_target > 0 ? Math.min(100, Math.round((achieved / quantity_target) * 100)) : 0,
        days_left: daysLeft(t.end_date),
        completed: achieved >= quantity_target,
    };
}

// GET /api/targets — Admin: every Marketing employee's target for the
// given month (defaults to current month), so the Overview can show the
// full list — who has how much target, how much is done, how much is
// pending, and how many days are left to the Admin-set deadline.
router.get(
    '/',
    requireRole('Admin', 'Manager'),
    asyncHandler(async (req, res) => {
        const month = req.query.month || todayIST().slice(0, 7);
        const targets = await Target.find({ month }).populate('assigned_to', 'name employee_id');
        // Skip orphaned targets — the assigned employee may have since been
        // deleted (a hard delete from Employees) — otherwise this whole
        // list crashes for every target instead of just hiding the stale one.
        const liveTargets = targets.filter(t => t.assigned_to);
        const rows = await Promise.all(
            liveTargets.map(async t => serialize(t, await achievedQuantity(t.assigned_to._id, t.start_date, t.end_date)))
        );
        rows.sort((a, b) => (a.employee_name || '').localeCompare(b.employee_name || ''));

        const summary = rows.reduce(
            (acc, r) => ({
                total_target: acc.total_target + r.quantity_target,
                total_achieved: acc.total_achieved + r.achieved,
                total_remaining: acc.total_remaining + r.remaining,
            }),
            { total_target: 0, total_achieved: 0, total_remaining: 0 }
        );

        sendJson(res, true, '', { targets: rows, summary, month });
    })
);

// POST /api/targets  { assigned_to, quantity_target, start_date?, end_date, month?, notes? }
// Admin sets (or edits, if one already exists for that employee+month) a
// target — including the last date to complete it.
router.post(
    '/',
    requireRole('Admin', 'Manager'),
    asyncHandler(async (req, res) => {
        const { assigned_to, quantity_target, end_date, notes } = req.body || {};
        const start_date = req.body?.start_date || todayIST();
        const month = req.body?.month || start_date.slice(0, 7);

        if (!assigned_to || !Number.isFinite(Number(quantity_target)) || Number(quantity_target) <= 0 || !end_date) {
            return sendJson(res, false, 'Select an employee, a total quantity target, and the last date.', {}, 422);
        }
        if (end_date < start_date) {
            return sendJson(res, false, 'The last date must be on or after the start date.', {}, 422);
        }
        const employee = await User.findOne({ _id: assigned_to, role: 'Marketing' });
        if (!employee) return sendJson(res, false, 'Marketing employee not found.', {}, 404);

        const target = await Target.findOneAndUpdate(
            { assigned_to, month },
            {
                assigned_to,
                assigned_by: req.user._id,
                month,
                quantity_target: Number(quantity_target),
                start_date,
                end_date,
                notes: notes || '',
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        sendJson(res, true, `Target set for ${employee.name}.`, { id: target._id });
    })
);

// DELETE /api/targets/:id — Admin removes a target.
router.delete(
    '/:id',
    requireRole('Admin', 'Manager'),
    asyncHandler(async (req, res) => {
        const t = await Target.findByIdAndDelete(req.params.id);
        if (!t) return sendJson(res, false, 'Target not found.', {}, 404);
        sendJson(res, true, 'Target removed.');
    })
);

// GET /api/targets/mine — the logged-in Marketing employee's own current
// target + live progress, for their own dashboard / "My Plan" screen.
router.get(
    '/mine',
    asyncHandler(async (req, res) => {
        const month = req.query.month || todayIST().slice(0, 7);
        const target = await Target.findOne({ assigned_to: req.user._id, month }).populate('assigned_to', 'name employee_id');
        if (!target) return sendJson(res, true, '', { target: null });
        const achieved = await achievedQuantity(req.user._id, target.start_date, target.end_date);
        sendJson(res, true, '', { target: serialize(target, achieved) });
    })
);

module.exports = router;
