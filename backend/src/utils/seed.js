/**
 * Run once after connecting to a fresh database: `npm run seed`
 * Creates the default Admin login (employee_id "admin" / password "admin123")
 * if it doesn't already exist — same bootstrap credentials as the PHP version.
 * Change the password immediately after first login in production.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

(async () => {
    await connectDB();
    const exists = await User.findOne({ employee_id: 'admin' });
    if (exists) {
        console.log('[seed] Admin account already exists — nothing to do.');
        process.exit(0);
    }
    await User.create({
        employee_id: 'admin',
        name: 'Administrator',
        mobile: '0000000000',
        designation: 'Admin',
        role: 'Admin',
        password_hash: await bcrypt.hash('admin123', 10),
    });
    console.log('[seed] Created default admin (employee_id: admin, password: admin123). Change this password after first login.');
    process.exit(0);
})();
