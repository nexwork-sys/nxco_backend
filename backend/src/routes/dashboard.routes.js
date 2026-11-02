const express = require('express');
const Attendance = require('../models/Attendance');
const Party = require('../models/Party');
const Order = require('../models/Order');
const Target = require('../models/Target');
const { requireLogin, requireRole, sendJson } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { todayIST } = require('../utils/dateIST');

function istDateRange(startStr, endStr) {
    return {
        $gte: new Date(`${startStr}T00:00:00+05:30`),
        $lte: new Date(`${endStr}T23:59:59.999+05:30`),
    };
}

const router = express.Router();

router.use(requireLogin);

// GET /api/dashboard/stats — the four Overview stat boxes: how many
// employees have marked attendance today, how many orders are still in
// the pipeline vs Completed, and the total (approved) party count.
router.get(
    '/stats',
    requireRole('Admin'),
    asyncHandler(async (req, res) => {
        const [presentToday, totalParties, orders] = await Promise.all([
            Attendance.countDocuments({ date: todayIST() }),
            Party.countDocuments({ status: 'Approved' }),
            Order.find().select('status'),
        ]);
        const completedOrders = orders.filter(o => o.status === 'Completed').length;
        const currentOrders = orders.filter(o => !['Completed', 'Cancelled'].includes(o.status)).length;

        // Target overview for the current month — total target quantity
        // across every Marketing employee, how much has been achieved via
        // orders so far, and how much is still pending.
        const month = todayIST().slice(0, 7);
        const targets = await Target.find({ month }).populate('assigned_to', 'name');
        const targetOrders = targets.length
            ? await Order.find({
                  created_by: { $in: targets.map(t => t.assigned_to?._id) },
                  status: { $ne: 'Cancelled' },
              }).select('created_by items createdAt')
            : [];
        let target_total = 0;
        let target_achieved = 0;
        for (const t of targets) {
            target_total += t.quantity_target;
            const range = istDateRange(t.start_date, t.end_date);
            const achieved = targetOrders
                .filter(o => String(o.created_by) === String(t.assigned_to?._id) && o.createdAt >= range.$gte && o.createdAt <= range.$lte)
                .reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0), 0);
            target_achieved += achieved;
        }

        sendJson(res, true, '', {
            present_today: presentToday,
            total_parties: totalParties,
            current_orders: currentOrders,
            completed_orders: completedOrders,
            total_orders: orders.length,
            target_total,
            target_achieved,
            target_remaining: Math.max(0, target_total - target_achieved),
            target_employee_count: targets.length,
        });
    })
);

module.exports = router;
