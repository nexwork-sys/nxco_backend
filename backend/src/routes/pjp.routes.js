const express = require('express');
const Pjp = require('../models/Pjp');
const Visit = require('../models/Visit');
const User = require('../models/User');
const { requireLogin, requireRole, sendJson } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { todayIST } = require('../utils/dateIST');

const router = express.Router();
router.use(requireLogin);

// Admin or Manager can build a Marketing employee's journey plan.
const canPlan = requireRole('Admin', 'Manager');

// GET /api/pjp/marketing-users — the list to assign a plan to.
router.get(
    '/marketing-users',
    canPlan,
    asyncHandler(async (req, res) => {
        const users = await User.find({ role: 'Marketing', active: true })
            .sort({ name: 1 })
            .select('name employee_id');
        sendJson(res, true, '', { users });
    })
);

// POST /api/pjp  { assigned_to, party_ids: [...] } — sets/replaces TODAY's
// plan for that Marketing employee (one plan per employee per day).
router.post(
    '/',
    canPlan,
    asyncHandler(async (req, res) => {
        const { assigned_to, party_ids } = req.body || {};
        if (!assigned_to || !Array.isArray(party_ids) || party_ids.length === 0) {
            return sendJson(res, false, 'Select an employee and at least one party.', {}, 422);
        }
        const date = todayIST();
        await Pjp.findOneAndUpdate(
            { date, assigned_to },
            { date, assigned_to, party_ids, created_by: req.user._id },
            { upsert: true, setDefaultsOnInsert: true }
        );
        sendJson(res, true, "Today's plan saved.");
    })
);

// GET /api/pjp/today — a Marketing employee's own plan for today, each
// party flagged with whether it's already been visited (logged) today.
router.get(
    '/today',
    asyncHandler(async (req, res) => {
        const date = todayIST();
        const pjp = await Pjp.findOne({ date, assigned_to: req.user._id }).populate('party_ids');
        if (!pjp) return sendJson(res, true, '', { parties: [] });

        const visitsToday = await Visit.find({ visited_by: req.user._id, date });
        const visitedIds = new Set(visitsToday.map(v => String(v.party_id)));

        const parties = pjp.party_ids
            .filter(Boolean) // a party referenced in an old plan may since have been deleted
            .map(p => ({
                ...p.toJSONWithIcon(),
                visited_today: visitedIds.has(String(p._id)),
            }));
        sendJson(res, true, '', { parties });
    })
);

// GET /api/pjp/status?date=YYYY-MM-DD  (defaults to today) — "who was
// planned to visit whom, and did the revisit actually happen". Unlike
// /today (which is only for the logged-in Marketing user and only today),
// this works for ANY date — including past dates — so a plan doesn't
// disappear once the day is over even if a party was never revisited.
// Admin/Manager see everyone's plans (optionally scoped with ?user_id=).
// Marketing can see this too, but only their own plan — whether it's
// complete or pending — same as Admin/Manager see it.
router.get(
    '/status',
    asyncHandler(async (req, res) => {
        const date = req.query.date || todayIST();
        const filter = { date };
        if (req.user.role === 'Marketing') {
            filter.assigned_to = req.user._id; // Marketing only ever sees their own plan
        } else if (req.query.user_id) {
            filter.assigned_to = req.query.user_id;
        }

        const plans = await Pjp.find(filter)
            .populate('assigned_to', 'name employee_id')
            .populate('party_ids', 'party_name area city')
            .populate('created_by', 'name');

        const visits = await Visit.find({ date }).select('party_id visited_by');
        const visitedKey = new Set(visits.map(v => `${v.visited_by}:${v.party_id}`));

        const rows = plans.map(p => {
            const parties = (p.party_ids || []).filter(Boolean).map(party => ({
                id: party._id,
                party_name: party.party_name,
                area: party.area,
                city: party.city,
                visited: visitedKey.has(`${p.assigned_to._id}:${party._id}`),
            }));
            const visitedCount = parties.filter(pt => pt.visited).length;
            return {
                id: p._id,
                date: p.date,
                assigned_to: p.assigned_to?._id,
                employee_name: p.assigned_to?.name,
                employee_id: p.assigned_to?.employee_id,
                planned_by: p.created_by?.name,
                planned_count: parties.length,
                visited_count: visitedCount,
                pending_count: parties.length - visitedCount,
                parties,
            };
        });
        rows.sort((a, b) => (a.employee_name || '').localeCompare(b.employee_name || ''));

        const summary = rows.reduce(
            (acc, r) => ({
                planned: acc.planned + r.planned_count,
                visited: acc.visited + r.visited_count,
                pending: acc.pending + r.pending_count,
            }),
            { planned: 0, visited: 0, pending: 0 }
        );

        sendJson(res, true, '', { date, plans: rows, summary });
    })
);

module.exports = router;
