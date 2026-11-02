const express = require('express');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const Party = require('../models/Party');
const Visit = require('../models/Visit');
const User = require('../models/User');
const { requireLogin, requireRole, sendJson } = require('../middleware/auth');
const { makeUploader, UPLOAD_ROOT } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
// Every other route file wires this up — it was missing here, which meant
// req.user was never populated: requireRole('Admin', 'Manager', ...) always
// bounced with "Not authenticated" (approve, fill-form, add/update/delete
// party all broken), and GET /?status=all (what the Admin/Manager "Parties"
// screen always calls) crashed outright on req.user.role. This one line
// is the fix for the party-approval / fill-form / party-management flow.
router.use(requireLogin);
const partyImages = makeUploader('shops', ['.jpg', '.jpeg', '.png']).fields([
    { name: 'shop_image', maxCount: 1 },
    { name: 'owner_image', maxCount: 1 },
    { name: 'aadhar_image', maxCount: 1 },
    { name: 'pan_image', maxCount: 1 },
]);
const VALID_VEHICLE_TYPES = ['truck', 'pickup', 'magic', 'auto', 'toto'];

function parseVehicleTypes(raw) {
    if (raw === undefined) return undefined;
    const list = Array.isArray(raw) ? raw : String(raw).split(',');
    return list.map(v => v.trim()).filter(v => VALID_VEHICLE_TYPES.includes(v));
}

/** Parses the fill-form's per-product rates: '[{"product_id":"...","rate":100}, ...]'. */
function parseProductRates(raw) {
    if (raw === undefined) return undefined;
    let list;
    try {
        list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
        return null;
    }
    if (!Array.isArray(list)) return null;
    for (const r of list) {
        if (!r.product_id || !Number.isFinite(Number(r.rate)) || Number(r.rate) < 0) return null;
    }
    return list.map(r => ({ product_id: r.product_id, rate: Number(r.rate) }));
}

/** Relative /uploads path for a fill-form file field, if one was sent. */
function uploadedPath(files, field) {
    return files?.[field]?.[0] ? `uploads/shops/${files[field][0].filename}` : null;
}

// GET /api/parties — any logged-in role can view. Defaults to Approved
// parties only (the usable network for ordering/visiting/planning);
// Admin/Manager pass ?status=all to see Pending ones too, for the party
// management and approvals screens. Anyone can pass ?mine=1 to see just
// the parties they personally added, at any status — e.g. Marketing
// checking whether the party they submitted is still Pending.
router.get(
    '/',
    asyncHandler(async (req, res) => {
        let filter;
        if (req.query.mine === '1') {
            filter = { created_by: req.user._id };
        } else {
            const wantsAll = req.query.status === 'all' && ['Admin', 'Manager'].includes(req.user.role);
            filter = wantsAll ? {} : { status: 'Approved' };
        }
        const parties = await Party.find(filter).sort({ party_name: 1 });

        // One most-recent Visit per party, joined with the visitor's name —
        // shown as "Last Visit" on every party's dashboard card.
        const lastVisits = await Visit.aggregate([
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$party_id',
                    date: { $first: '$date' },
                    note: { $first: '$note' },
                    visited_by: { $first: '$visited_by' },
                },
            },
        ]);
        const visitors = await User.find({ _id: { $in: lastVisits.map(v => v.visited_by) } }).select('name');
        const nameById = new Map(visitors.map(u => [String(u._id), u.name]));
        const lastVisitByParty = new Map(
            lastVisits.map(v => [
                String(v._id),
                { date: v.date, note: v.note, visited_by_name: nameById.get(String(v.visited_by)) || null },
            ])
        );

        sendJson(res, true, '', {
            parties: parties.map(p => ({
                ...p.toJSONWithIcon(),
                last_visit: lastVisitByParty.get(String(p._id)) || null,
            })),
        });
    })
);

// POST /api/parties — Admin/Manager (auto-approved) or Marketing (goes to
// Pending, needs Admin/Manager approval before it can be visited/ordered)
router.post(
    '/',
    requireRole('Admin', 'Manager', 'Marketing'),
    partyImages,
    asyncHandler(async (req, res) => {
        const { party_name, owner_name, mobile, water_brand, years_exp, vehicle_types, area, city, address, lat, lng } = req.body || {};
        if (!party_name || !owner_name || !mobile || !lat || !lng) {
            return sendJson(res, false, 'Party name, owner, mobile, and location are required.', {}, 422);
        }
        const autoApprove = ['Admin', 'Manager'].includes(req.user.role);
        const party = await Party.create({
            party_name: party_name.trim(),
            owner_name: owner_name.trim(),
            mobile: mobile.trim(),
            water_brand: water_brand || '',
            years_exp: Number(years_exp) || 0,
            vehicle_types: parseVehicleTypes(vehicle_types) || [],
            area: area || '',
            city: city || '',
            address: address || '',
            shop_image: req.files?.shop_image?.[0] ? `uploads/shops/${req.files.shop_image[0].filename}` : null,
            owner_image: req.files?.owner_image?.[0] ? `uploads/shops/${req.files.owner_image[0].filename}` : null,
            lat: Number(lat),
            lng: Number(lng),
            created_by: req.user._id,
            status: autoApprove ? 'Approved' : 'Pending',
            approved_by: autoApprove ? req.user._id : null,
            approved_at: autoApprove ? new Date() : null,
        });
        sendJson(
            res,
            true,
            autoApprove ? 'Party created.' : 'Party submitted — waiting for Admin/Manager approval.',
            { id: party._id }
        );
    })
);

// POST /api/parties/:id/update
router.post(
    '/:id/update',
    requireRole('Admin', 'Manager', 'Marketing'),
    partyImages,
    asyncHandler(async (req, res) => {
        const party = await Party.findById(req.params.id);
        if (!party) return sendJson(res, false, 'Party not found.', {}, 404);

        const fields = ['party_name', 'owner_name', 'mobile', 'water_brand', 'area', 'city', 'address'];
        fields.forEach(f => {
            if (req.body[f] !== undefined) party[f] = req.body[f];
        });
        if (req.body.years_exp !== undefined) party.years_exp = Number(req.body.years_exp) || 0;
        if (req.body.vehicle_types !== undefined) {
            party.vehicle_types = parseVehicleTypes(req.body.vehicle_types) || [];
        }
        if (req.body.lat !== undefined) party.lat = Number(req.body.lat);
        if (req.body.lng !== undefined) party.lng = Number(req.body.lng);
        if (req.files?.shop_image?.[0]) party.shop_image = `uploads/shops/${req.files.shop_image[0].filename}`;
        if (req.files?.owner_image?.[0]) party.owner_image = `uploads/shops/${req.files.owner_image[0].filename}`;

        await party.save();
        sendJson(res, true, 'Party updated.');
    })
);

// POST /api/parties/:id/approve — Admin/Manager approves a Pending party
router.post(
    '/:id/approve',
    requireRole('Admin', 'Manager'),
    asyncHandler(async (req, res) => {
        const party = await Party.findById(req.params.id);
        if (!party) return sendJson(res, false, 'Party not found.', {}, 404);
        party.status = 'Approved';
        party.approved_by = req.user._id;
        party.approved_at = new Date();
        await party.save();
        sendJson(res, true, 'Party approved.');
    })
);

// POST /api/parties/:id/fill-form — the commercial KYC form for an
// Approved party: Admin/Manager approves the party itself, but Admin or
// Marketing fills in this form (owner/Aadhar/PAN photos,
// per-product rates) once it's approved. This gates order placement —
// Marketing can only order for a party once the form is fully complete.
router.post(
    '/:id/fill-form',
    // Manager's job ends at approving the party — the Fill Form (KYC +
    // rates) is filled by Marketing (who onboarded the party) or Admin,
    // not Manager.
    requireRole('Admin', 'Marketing'),
    partyImages,
    asyncHandler(async (req, res) => {
        const party = await Party.findById(req.params.id);
        if (!party) return sendJson(res, false, 'Party not found.', {}, 404);
        if (party.status !== 'Approved') {
            return sendJson(res, false, 'Approve this party first before filling in its form.', {}, 409);
        }

        // Cash / Credit + cheque are chosen per ORDER now (orders.routes.js), not here.
        const { aadhar_no, pan_no, gst_no, form_no, comment } = req.body || {};
        if (aadhar_no !== undefined) party.aadhar_no = aadhar_no;
        if (pan_no !== undefined) party.pan_no = pan_no;
        if (gst_no !== undefined) party.gst_no = gst_no; // optional, either payment mode
        if (form_no !== undefined) party.form_no = form_no;
        if (comment !== undefined) party.comment = comment;

        if (uploadedPath(req.files, 'owner_image')) party.owner_image = uploadedPath(req.files, 'owner_image');
        if (uploadedPath(req.files, 'aadhar_image')) party.aadhar_image = uploadedPath(req.files, 'aadhar_image');
        if (uploadedPath(req.files, 'pan_image')) party.pan_image = uploadedPath(req.files, 'pan_image');

        if (req.body.product_rates !== undefined) {
            const rates = parseProductRates(req.body.product_rates);
            if (rates === null) return sendJson(res, false, 'Invalid product rates.', {}, 422);
            party.product_rates = rates;
        }

        // Everything the Cash flow needs; Credit additionally needs the
        // the rest. Nothing here blocks saving what WAS provided —
        // it just decides whether the form counts as "complete" (which is
        // what unlocks order placement for this party).
        const missing = [];
        if (!party.owner_image) missing.push('Owner Photo');
        if (!party.aadhar_no) missing.push('Aadhar Number');
        if (!party.aadhar_image) missing.push('Aadhar Photo');
        if (!party.pan_no) missing.push('PAN Number');
        if (!party.pan_image) missing.push('PAN Photo');
        if (!party.comment) missing.push('Comment');
        if (party.product_rates.length === 0) missing.push('Product Rate');

        party.fill_form_completed = missing.length === 0;

        await party.save();
        sendJson(res, true, party.fill_form_completed ? 'Fill Form saved.' : 'Saved — still missing: ' + missing.join(', '), {
            fill_form_completed: party.fill_form_completed,
        });
    })
);

// POST /api/parties/:id/delete — Admin/Manager (also used to reject a
// Pending party)
router.post(
    '/:id/delete',
    requireRole('Admin', 'Manager'),
    asyncHandler(async (req, res) => {
        const party = await Party.findById(req.params.id);
        if (!party) return sendJson(res, false, 'Party not found.', {}, 404);
        await party.deleteOne();
        sendJson(res, true, 'Party deleted.');
    })
);

// GET /api/parties/:id/pdf — a downloadable "Party Details" PDF: the
// party's own info, the shop/owner photos from the dashboard, and the
// Aadhar/PAN photos from the Fill Form, all combined into one
// file so Admin can save or share the full record for a party.
router.get(
    '/:id/pdf',
    asyncHandler(async (req, res) => {
        const party = await Party.findById(req.params.id);
        if (!party) return sendJson(res, false, 'Party not found.', {}, 404);

        const companyName = process.env.COMPANY_NAME || 'NXCO';
        const safeName = (party.party_name || 'party').replace(/[^a-z0-9]+/gi, '_');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}_details.pdf"`);

        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        doc.pipe(res);

        const pageBottom = () => doc.page.height - doc.page.margins.bottom;
        function ensureSpace(needed) {
            if (doc.y + needed > pageBottom()) doc.addPage();
        }

        /** A relative `uploads/...` path from the DB -> absolute file path on disk. */
        function absPath(relPath) {
            return relPath ? path.join(UPLOAD_ROOT, '..', relPath) : null;
        }

        function row(label, value) {
            doc.font('Helvetica-Bold').fontSize(10).text(`${label}: `, { continued: true });
            doc.font('Helvetica').text(value || '-');
        }

        // Draws one labeled photo box at (x, boxTop); shows a placeholder
        // note instead of failing when the file was never uploaded or is
        // missing on disk.
        function addPhoto(label, relPath, x, boxTop, w, h) {
            doc.font('Helvetica-Bold').fontSize(9).text(label, x, boxTop);
            const imgTop = boxTop + 13;
            const file = absPath(relPath);
            if (file && fs.existsSync(file)) {
                try {
                    doc.image(file, x, imgTop, { fit: [w, h] });
                    return;
                } catch {
                    // fall through to the "not available" note below
                }
            }
            doc.font('Helvetica').fontSize(8).fillColor('#999').text('Not uploaded.', x, imgTop);
            doc.fillColor('#000');
        }

        // Header
        doc.fontSize(18).font('Helvetica-Bold').text(companyName);
        doc.fontSize(10).font('Helvetica').fillColor('#555').text('Party Details Report');
        doc.fillColor('#000');
        doc.moveDown(0.8);

        doc.fontSize(16).font('Helvetica-Bold').text(party.party_name);
        doc.fontSize(9).font('Helvetica').fillColor('#888').text(`Status: ${party.status}`);
        doc.fillColor('#000');
        doc.moveDown(0.6);

        // Party details
        row('Owner Name', party.owner_name);
        row('Mobile', party.mobile);
        row('Water Brand', party.water_brand);
        row('Area / City', `${party.area || '-'}, ${party.city || '-'}`);
        row('Address', party.address);
        row('Vehicle Access', (party.vehicle_types || []).join(', '));
        row('Years of Experience', String(party.years_exp || 0));
        doc.moveDown(0.6);

        // Fill Form / KYC details
        doc.font('Helvetica-Bold').fontSize(11).text('Fill Form / KYC Details');
        doc.moveDown(0.2);
        row('Aadhar Number', party.aadhar_no);
        row('PAN Number', party.pan_no);
        row('GST Number', party.gst_no);
        row('Comment', party.comment);
        doc.moveDown(1);

        const colW = 240;
        const rowH = 150;
        const gap = 20;

        // Dashboard photos: shop + owner
        ensureSpace(rowH + 30);
        doc.font('Helvetica-Bold').fontSize(11).text('Dashboard Photos');
        doc.moveDown(0.3);
        let y = doc.y;
        addPhoto('Shop Photo', party.shop_image, 40, y, colW, rowH);
        addPhoto('Owner Photo', party.owner_image, 40 + colW + gap, y, colW, rowH);
        doc.y = y + rowH + 24;

        // Fill Form documents: Aadhar + PAN
        ensureSpace(rowH + 30);
        doc.font('Helvetica-Bold').fontSize(11).text('Fill Form Documents', 40, doc.y);
        doc.moveDown(0.3);
        y = doc.y;
        addPhoto('Aadhar Photo', party.aadhar_image, 40, y, colW, rowH);
        addPhoto('PAN Photo', party.pan_image, 40 + colW + gap, y, colW, rowH);
        doc.y = y + rowH + 24;

        doc.moveDown(1);
        doc.font('Helvetica').fontSize(8).fillColor('#888').text(`Generated on ${new Date().toLocaleString('en-IN')}`, 40);

        doc.end();
    })
);

module.exports = router;
