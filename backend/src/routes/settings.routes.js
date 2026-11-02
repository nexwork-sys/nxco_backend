const express = require('express');
const CompanySettings = require('../models/CompanySettings');
const { requireLogin, requireRole, sendJson } = require('../middleware/auth');
const { makeUploader } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
const uploadLogo = makeUploader('branding', ['.jpg', '.jpeg', '.png', '.svg', '.webp']);

router.use(requireLogin);

// GET /api/settings — any logged-in user (needed for geofence checks & branding client-side)
router.get(
    '/',
    asyncHandler(async (req, res) => {
        const settings = await CompanySettings.getSingleton();
        sendJson(res, true, '', { settings });
    })
);

// POST /api/settings — Admin only. Accepts multipart (logo_file) and/or JSON location fields.
router.post(
    '/',
    requireRole('Admin'),
    uploadLogo.single('logo_file'),
    asyncHandler(async (req, res) => {
        const settings = await CompanySettings.getSingleton();
        const body = req.body || {};

        if (body.company_lat !== undefined) settings.company_lat = Number(body.company_lat);
        if (body.company_lng !== undefined) settings.company_lng = Number(body.company_lng);
        if (body.allowed_radius_meters !== undefined) settings.allowed_radius_meters = Number(body.allowed_radius_meters);
        if (req.file) settings.logo_path = `uploads/branding/${req.file.filename}`;

        await settings.save();
        sendJson(res, true, 'Settings updated.', { logo_path: settings.logo_path });
    })
);

module.exports = router;
