const mongoose = require('mongoose');

// One target per (assigned_to, month) — Admin sets how many total product
// units a Marketing employee must sell in a period, and the last date
// (deadline) by which it should be completed. Achieved quantity is *not*
// stored here — it's computed live from Orders so it always reflects
// reality even if an order is edited/cancelled after the target was set.
const targetSchema = new mongoose.Schema(
    {
        assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        // 'YYYY-MM' — which month this target belongs to, shown on the
        // Overview/Targets screens ("target for August 2026").
        month: { type: String, required: true },
        // Total quantity (units, across all products) this employee must
        // reach in the period below.
        quantity_target: { type: Number, required: true, min: 1 },
        start_date: { type: String, required: true }, // IST 'YYYY-MM-DD'
        // Admin-set deadline — the last date to complete this target.
        end_date: { type: String, required: true }, // IST 'YYYY-MM-DD'
        notes: { type: String, default: '' },
    },
    { timestamps: true }
);

// One active target per employee per month — saving again for the same
// month replaces it, same pattern as Pjp's (date, assigned_to) upsert.
targetSchema.index({ assigned_to: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Target', targetSchema);
