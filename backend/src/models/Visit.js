const mongoose = require('mongoose');

// One row per visit/revisit a Marketing employee logs against a party —
// "what happened" on that visit. The most recent one per party is shown
// as that party's "Last Visit" on every dashboard (Admin/Manager/Marketing).
const visitSchema = new mongoose.Schema(
    {
        party_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
        visited_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        note: { type: String, default: '' },
        date: { type: String, required: true }, // IST 'YYYY-MM-DD', for "visited today" checks
    },
    { timestamps: true }
);

visitSchema.index({ party_id: 1, createdAt: -1 });

module.exports = mongoose.model('Visit', visitSchema);
