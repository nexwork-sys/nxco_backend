const bcrypt = require('bcryptjs');
const User = require('../models/User');

module.exports = async function ensureAdmin() {
    try {
        const junk = await User.collection.deleteMany({ employee_id: { $exists: false } });
        if (junk.deletedCount) console.log(`[admin] Removed ${junk.deletedCount} broken user document(s).`);

        try { await User.collection.dropIndex('email_1'); console.log('[admin] Dropped stray index email_1.'); } catch (_) {}

        const admin = await User.findOne({ employee_id: 'admin' });
        if (!admin) {
            await User.create({
                employee_id: 'admin', name: 'Administrator', mobile: '0000000000',
                designation: 'Admin', role: 'Admin',
                password_hash: await bcrypt.hash('admin123', 10),
            });
            console.log('[admin] Created default admin (admin / admin123).');
        } else if (String(process.env.ADMIN_RESET).toLowerCase() === 'true') {
            admin.role = 'Admin'; admin.active = true;
            admin.password_hash = await bcrypt.hash('admin123', 10);
            await admin.save();
            console.log('[admin] ADMIN_RESET=true -> admin reset to admin123.');
        }
    } catch (e) {
        console.error('[admin] ensureAdmin failed:', e.message);
    }
};
