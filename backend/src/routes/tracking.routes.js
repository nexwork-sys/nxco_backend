const express = require('express');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { requireLogin, requireRole, sendJson } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { todayIST } = require('../utils/dateIST');

const router = express.Router();
router.use(requireLogin);

// POST /api/tracking/ping  { lat, lng } — any checked-in field role calls this
// periodically (every ~10–15s) while active, so Admin's live map stays current.
router.post(
    '/ping',
    asyncHandler(async (req, res) => {
        const { lat, lng } = req.body || {};
        if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
            return sendJson(res, false, 'lat/lng required.', {}, 422);
        }
        await User.findByIdAndUpdate(req.user._id, { lat: Number(lat), lng: Number(lng), location_updated_at: new Date() });
        sendJson(res, true, 'Location updated.');
    })
);

// GET /api/tracking/live — Admin only. Everyone checked in today who hasn't
// checked out yet, with their last-known lat/lng — polled by the Live
// Tracking map every ~10s.
router.get(
    '/live',
    requireRole('Admin'),
    asyncHandler(async (req, res) => {
        const todayStr = todayIST();
        const records = await Attendance.find({ date: todayStr, time_out: null }).populate(
            'user_id',
            'employee_id name designation role lat lng location_updated_at'
        );

        const active = records
            .filter(r => r.user_id) // guard against orphaned records
            .map(r => ({
                id: r.user_id._id,
                employee_id: r.user_id.employee_id,
                name: r.user_id.name,
                designation: r.user_id.designation,
                role: r.user_id.role,
                lat: r.user_id.lat,
                lng: r.user_id.lng,
                updated_at: r.user_id.location_updated_at,
                time_in: r.time_in,
                time_out: r.time_out,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        sendJson(res, true, '', { active_employees: active });
    })
);

module.exports = router;
