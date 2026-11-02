const express = require('express');
const Visit = require('../models/Visit');
const Party = require('../models/Party');
const { requireLogin, requireRole, sendJson } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { todayIST } = require('../utils/dateIST');

const router = express.Router();
router.use(requireLogin);

// POST /api/visits  { party_id, note } — "Revisit": logs what happened on
// this visit. Becomes the party's new Last Visit, shown on every party's
// dashboard (GET /api/parties attaches the latest one per party).
router.post(
    '/',
    requireRole('Marketing', 'Admin', 'Manager'),
    asyncHandler(async (req, res) => {
        const { party_id, note } = req.body || {};
        if (!party_id) return sendJson(res, false, 'Select a party first.', {}, 422);

        const party = await Party.findById(party_id);
        if (!party) return sendJson(res, false, 'Party not found.', {}, 404);

        await Visit.create({
            party_id,
            visited_by: req.user._id,
            note: (note || '').trim(),
            date: todayIST(),
        });
        sendJson(res, true, 'Visit logged.');
    })
);

module.exports = router;
