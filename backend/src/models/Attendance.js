const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        date: { type: String, required: true }, // 'YYYY-MM-DD', one record per user per day
        time_in: { type: String, default: null }, // 'HH:MM:SS'
        time_out: { type: String, default: null },
        attendance_type: { type: String, enum: ['Office', 'Field'], default: 'Office' },
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
        status: { type: String, default: 'Present' },
        // Marketing check-ins are tied to the party they visited — required
        // since attendance must be within 1000m of that party's shop.
        party_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },
    },
    { timestamps: true }
);

attendanceSchema.index({ user_id: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
