const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireLogin, sendJson } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Same per-role landing screen mapping the PHP login.php returned, kept so
// the mobile app can route straight to the right dashboard after login.
const ROLE_HOME = {
    Admin: 'AdminHome',
    Marketing: 'MarketingHome',
    Supervisor: 'SupervisorHome',
    Manager: 'SupervisorHome',
    Operator: 'SupervisorHome',
    Driver: 'DriverHome',
};

function signToken(user) {
    return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });
}

// POST /api/auth/login  { employee_id, password }
router.post(
    '/login',
    asyncHandler(async (req, res) => {
        const { employee_id, password } = req.body || {};
        if (!employee_id || !password) {
            return sendJson(res, false, 'Employee ID and password are required.', {}, 422);
        }

        const user = await User.findOne({ employee_id: employee_id.trim(), active: true });
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return sendJson(res, false, 'Invalid employee ID or password.', {}, 401);
        }

        const token = signToken(user);
        sendJson(res, true, 'Login successful.', {
            token,
            user: user.toSafeJSON(),
            home: ROLE_HOME[user.role] || 'AdminHome',
        });
    })
);

// GET /api/auth/me — used by the app on launch to validate a stored token
// and figure out which role's navigator to mount.
router.get(
    '/me',
    requireLogin,
    asyncHandler(async (req, res) => {
        sendJson(res, true, '', { user: req.user.toSafeJSON() });
    })
);

// POST /api/auth/change-password  { current_password, new_password }
router.post(
    '/change-password',
    requireLogin,
    asyncHandler(async (req, res) => {
        const { current_password, new_password } = req.body || {};
        if (!current_password || !new_password || new_password.length < 6) {
            return sendJson(res, false, 'New password must be at least 6 characters.', {}, 422);
        }
        const ok = await bcrypt.compare(current_password, req.user.password_hash);
        if (!ok) return sendJson(res, false, 'Current password is incorrect.', {}, 401);

        req.user.password_hash = await bcrypt.hash(new_password, 10);
        await req.user.save();
        sendJson(res, true, 'Password updated.');
    })
);

module.exports = router;
