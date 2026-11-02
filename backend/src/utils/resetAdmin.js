/**
 * Force the default Admin login back to: employee_id "admin" / password "admin123"
 * Run: `npm run reset-admin`   (uses MONGODB_URI from .env)
 *
 * Unlike `npm run seed` (which does nothing if "admin" already exists), this creates the
 * admin if missing, or resets its password, role and active flag if it already exists.
 * It also removes broken documents that have no employee_id (e.g. left by an old/wrong seed script).
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

(async () => {
    try {
        await connectDB();

        const junk = await User.collection.deleteMany({ employee_id: { $exists: false } });
        if (junk.deletedCount) console.log(`[reset-admin] Removed ${junk.deletedCount} broken user document(s) without employee_id.`);

        try { await User.collection.dropIndex('email_1'); } catch (_) {}

        await User.findOneAndUpdate(
            { employee_id: 'admin' },
            {
                $set: {
                    name: 'Administrator',
                    mobile: '0000000000',
                    designation: 'Admin',
                    role: 'Admin',
                    active: true,
                    password_hash: await bcrypt.hash('admin123', 10),
                },
            },
            { upsert: true, setDefaultsOnInsert: true }
        );
        console.log('[reset-admin] Done. Login with  User ID: admin   Password: admin123');
        await mongoose.disconnect();
        process.exit(0);
    } catch (e) {
        console.error('[reset-admin] Failed:', e.message);
        process.exit(1);
    }
})();
