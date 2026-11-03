const bcrypt = require('bcryptjs');
const User = require('../models/User');

module.exports = async function ensureAdmin() {
    try {
        const junk = await User.collection.deleteMany({ employee_id: { $exists: false } });
        if (junk.deletedCount) console.log(`[admin] Removed ${junk.deletedCount} broken user document(s).`);

        try { await User.collection.dropIndex('email_1'); console.log('[admin] Dropped stray index email_1.'); } catch (_) {}

        const fullAdmin = async () => ({
            name: 'Administrator',
            mobile: '0000000000',
            designation: 'Admin',
            role: 'Admin',
            active: true,
            password_hash: await bcrypt.hash('admin123', 10),
        });

        const admin = await User.collection.findOne({ employee_id: 'admin' });
        if (!admin) {
            await User.create({ employee_id: 'admin', ...(await fullAdmin()) });
            console.log('[admin] Created default admin (admin / admin123).');
        } else {
            const incomplete = !admin.name || !admin.mobile || !admin.designation || !admin.password_hash || admin.role !== 'Admin' || admin.active === false;
            if (incomplete || String(process.env.ADMIN_RESET).toLowerCase() === 'true') {
                await User.collection.updateOne({ employee_id: 'admin' }, { $set: { ...(await fullAdmin()), updatedAt: new Date() } });
                console.log('[admin] Admin repaired/reset -> admin / admin123.');
            }
        }
    } catch (e) {
        console.error('[admin] ensureAdmin failed:', e.message);
    }
};
