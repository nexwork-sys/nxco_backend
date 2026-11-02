const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

function makeUploader(subfolder, allowedExt = ['.jpg', '.jpeg', '.png', '.pdf']) {
    const dir = path.join(UPLOAD_ROOT, subfolder);
    fs.mkdirSync(dir, { recursive: true });

    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, dir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
        },
    });

    return multer({
        storage,
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB cap, matches the PHP handle_upload()
        fileFilter: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, allowedExt.includes(ext));
        },
    });
}

module.exports = { makeUploader, UPLOAD_ROOT };
