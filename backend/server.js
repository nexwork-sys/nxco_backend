require('dotenv').config();
const connectDB = require('./src/config/db');
const app = require('./src/app');
const ensureAdmin = require('./src/utils/ensureAdmin');

const PORT = process.env.PORT || 4000;

(async () => {
    try {
        await connectDB();
        await ensureAdmin();
        app.listen(PORT, () => console.log(`[server] NXCO API listening on port ${PORT}`));
    } catch (err) {
        console.error('[server] Failed to start:', err.message);
        process.exit(1);
    }
})();
