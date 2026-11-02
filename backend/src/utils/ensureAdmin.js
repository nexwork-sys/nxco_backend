/**
 * Runs on every server start (after the DB connects), so no shell access is needed (e.g. on Render):
 *   - removes broken user documents that have no employee_id (left by wrong seed scripts)
 *   - drops a stray unique `email_1` index on `users` (also left by those scripts; it blocks new users)
 *   - creates the default Admin  (User ID: admin  /  Password: admin123)  if it does not exist
 *   - if the env var ADMIN_RESET=true is set, forces the admin back to admin123 + active + role Admin
 *     (remove the variable again after you have logged in and changed the password)
 */
const bcrypt = require('bcryptjs');
const User = require('../models/User');

module.exports = async function ensureAdmin() {
    try {
        const junk = await User.collection.deleteMany({ employee_id: { $exists: false } });
        if (junk.deletedCount) console.log(`[admin] Removed ${junk.deletedCount} broken user document(s) without employee_id.`);

        try {
            await User.collection.dropIndex('email_1');
            console.log('[admin] Dropped stray unique index email_1.');
        } catch (_) { /* index not present — fine */ }

        const admin = await User.findOne({ employee_id: 'admin' });
        if (!admin) {
            await User.create({
                employee_id: 'admin',
                name: 'Administrator',
                mobile: '0000000000',
                designation: 'Admin',
                role: 'Admin',
                password_hash: await bcrypt.hash('admin123', 10),
            });
            console.log('[admin] Created default admin  (User ID: admin / Password: admin123). Change the password after login.');
        } else if (String(process.env.ADMIN_RESET).toLowerCase() === 'true') {
            admin.role = 'Admin';
            admin.active = true;
            admin.password_hash = await bcrypt.hash('admin123', 10);
            await admin.save();
            console.log('[admin] ADMIN_RESET=true -> admin reset to User ID: admin / Password: admin123.');
        }
    } catch (e) {
        console.error('[admin] ensureAdmin failed (server keeps running):', e.message);
    }
};
