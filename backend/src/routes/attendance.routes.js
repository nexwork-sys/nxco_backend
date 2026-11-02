const express = require('express');
const Attendance = require('../models/Attendance');
const Party = require('../models/Party');
const CompanySettings = require('../models/CompanySettings');
const User = require('../models/User');
const { requireLogin, sendJson } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { haversineDistanceMeters } = require('../utils/distance');
const { todayIST, nowTimeIST } = require('../utils/dateIST');

const router = express.Router();
const MARKETING_RADIUS_METERS = 1000; // must be near the party's shop
const today = todayIST;
const nowTime = nowTimeIST;

router.use(requireLogin);

// POST /api/attendance/mark  { type: 'in'|'out', lat, lng, party_id? }
router.post(
    '/mark',
    asyncHandler(async (req, res) => {
        const { type, lat, lng, party_id } = req.body || {};
        if (!['in', 'out'].includes(type) || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
            return sendJson(res, false, 'Location and check-in/out type are required.', {}, 422);
        }

        if (type === 'in') {
            if (req.user.role === 'Marketing') {
                if (!party_id) {
                    return sendJson(
                        res,
                        false,
                        'Select the party you are visiting first. If it\'s a new shop, add it under "Add Party" and save it — then come back here and select it to mark attendance.',
                        {},
                        422
                    );
                }
                const party = await Party.findById(party_id);
                if (!party) return sendJson(res, false, 'Selected party not found.', {}, 404);
                const distance = haversineDistanceMeters(Number(lat), Number(lng), party.lat, party.lng);
                if (distance > MARKETING_RADIUS_METERS) {
                    return sendJson(
                        res,
                        false,
                        `You are ${Math.round(distance)}m away from ${party.party_name}. Move within ${MARKETING_RADIUS_METERS}m of the shop to mark attendance.`,
                        {},
                        403
                    );
                }
            } else if (['Supervisor', 'Manager', 'Operator', 'Driver'].includes(req.user.role)) {
                const settings = await CompanySettings.getSingleton();
                const distance = haversineDistanceMeters(Number(lat), Number(lng), settings.company_lat, settings.company_lng);
                if (distance > settings.allowed_radius_meters) {
                    return sendJson(
                        res,
                        false,
                        `You are ${Math.round(distance)}m away from the office. Move within ${settings.allowed_radius_meters}m to check in.`,
                        {},
                        403
                    );
                }
            }
        }

        const filter = { user_id: req.user._id, date: today() };
        let record = await Attendance.findOne(filter);

        if (type === 'in') {
            if (!record) {
                record = await Attendance.create({
                    user_id: req.user._id,
                    date: today(),
                    time_in: nowTime(),
                    attendance_type: req.user.role === 'Marketing' ? 'Field' : 'Office',
                    lat: Number(lat),
                    lng: Number(lng),
                    party_id: party_id || null,
                });
            } else if (record.time_out) {
                // Already checked out today — treat as a fresh check-in (multi-visit days).
                record.time_in = nowTime();
                record.time_out = null;
                record.lat = Number(lat);
                record.lng = Number(lng);
                record.party_id = party_id || null;
                await record.save();
            } else {
                return sendJson(res, false, 'You are already checked in.', {}, 409);
            }

            // Update the user's live location too, for the Live Tracking map.
            await User.findByIdAndUpdate(req.user._id, { lat: Number(lat), lng: Number(lng), location_updated_at: new Date() });
            return sendJson(res, true, 'Check-in recorded.');
        }

        // type === 'out'
        if (!record || !record.time_in || record.time_out) {
            return sendJson(res, false, 'You are not currently checked in.', {}, 409);
        }
        record.time_out = nowTime();
        await record.save();
        sendJson(res, true, 'Check-out recorded.');
    })
);

// GET /api/attendance/list?date=YYYY-MM-DD or ?from=YYYY-MM-DD&to=YYYY-MM-DD
// &search=name-or-employee-id&user_id=... — Admin sees everyone, others see
// only their own records.
router.get(
    '/list',
    asyncHandler(async (req, res) => {
        const filter = {};
        if (req.user.role !== 'Admin') {
            filter.user_id = req.user._id;
        } else if (req.query.user_id) {
            filter.user_id = req.query.user_id;
        }

        if (req.query.date) {
            filter.date = req.query.date;
        } else if (req.query.from || req.query.to) {
            // 'YYYY-MM-DD' strings compare correctly lexicographically.
            filter.date = {};
            if (req.query.from) filter.date.$gte = req.query.from;
            if (req.query.to) filter.date.$lte = req.query.to;
        }

        let records = await Attendance.find(filter)
            .populate('user_id', 'name employee_id designation role')
            .populate('party_id', 'party_name')
            .sort({ date: -1, time_in: -1 });

        const search = (req.query.search || '').trim().toLowerCase();
        if (search) {
            records = records.filter(a => (
                (a.user_id?.name || '').toLowerCase().includes(search) ||
                (a.user_id?.employee_id || '').toLowerCase().includes(search)
            ));
        }

        sendJson(res, true, '', {
            attendance: records.map(a => ({
                id: a._id,
                employee_id: a.user_id?.employee_id,
                name: a.user_id?.name,
                designation: a.user_id?.designation,
                role: a.user_id?.role,
                date: a.date,
                time_in: a.time_in,
                time_out: a.time_out,
                attendance_type: a.attendance_type,
                // Live status: checked in with no check-out yet = Active,
                // otherwise (checked out) = Inactive — this is what the
                // Admin app shows next to each employee's record.
                status: a.time_in && !a.time_out ? 'Active' : 'Inactive',
                lat: a.lat,
                lng: a.lng,
                party_name: a.party_id?.party_name || null,
            })),
        });
    })
);

module.exports = router;
