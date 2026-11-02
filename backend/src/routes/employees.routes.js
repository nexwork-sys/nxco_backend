const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireLogin, requireRole, sendJson } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Every route in this file is Admin-only, for every method — matching the
// original employees/index.php which called require_role(['Admin']) up
// front regardless of GET/POST.
router.use(requireLogin, requireRole('Admin'));

// GET /api/employees
router.get(
    '/',
    asyncHandler(async (req, res) => {
        const employees = await User.find().sort({ name: 1 });
        sendJson(res, true, '', { employees: employees.map(e => e.toSafeJSON()) });
    })
);

// POST /api/employees  { employee_id, name, mobile, designation, role, password }
router.post(
    '/',
    asyncHandler(async (req, res) => {
        const { employee_id, name, mobile, designation, role, password } = req.body || {};
        if (!employee_id || !name || !mobile || !designation || !role || !password) {
            return sendJson(res, false, 'All fields are required.', {}, 422);
        }
        const exists = await User.findOne({ employee_id: employee_id.trim() });
        if (exists) return sendJson(res, false, 'That Employee ID is already in use.', {}, 409);

        const password_hash = await bcrypt.hash(password, 10);
        const user = await User.create({
            employee_id: employee_id.trim(),
            name: name.trim(),
            mobile: mobile.trim(),
            designation: designation.trim(),
            role,
            password_hash,
        });
        sendJson(res, true, 'Employee created.', { id: user._id });
    })
);

// POST /api/employees/:id/update  { name, mobile, designation, role, password? }
router.post(
    '/:id/update',
    asyncHandler(async (req, res) => {
        const user = await User.findById(req.params.id);
        if (!user) return sendJson(res, false, 'Employee not found.', {}, 404);

        const { name, mobile, designation, role, password } = req.body || {};
        if (name) user.name = name.trim();
        if (mobile) user.mobile = mobile.trim();
        if (designation) user.designation = designation.trim();
        if (role) user.role = role;
        if (password) user.password_hash = await bcrypt.hash(password, 10);

        await user.save();
        sendJson(res, true, 'Employee updated.');
    })
);

// POST /api/employees/:id/delete
router.post(
    '/:id/delete',
    asyncHandler(async (req, res) => {
        const user = await User.findById(req.params.id);
        if (!user) return sendJson(res, false, 'Employee not found.', {}, 404);
        if (user.employee_id === 'admin') {
            return sendJson(res, false, 'The default admin account cannot be deleted.', {}, 403);
        }
        await user.deleteOne();
        sendJson(res, true, 'Employee deleted.');
    })
);

module.exports = router;
