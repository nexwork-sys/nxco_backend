const mongoose = require('mongoose');

// Permanent Journey Plan — Admin/Manager assigns a Marketing employee a
// list of parties to visit on a given day. One document per
// (date, assigned_to); saving again for the same day replaces the list,
// so a Manager can freely edit today's plan.
const pjpSchema = new mongoose.Schema(
    {
        date: { type: String, required: true }, // IST 'YYYY-MM-DD'
        assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        party_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Party' }],
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
);

pjpSchema.index({ date: 1, assigned_to: 1 }, { unique: true });

module.exports = mongoose.model('Pjp', pjpSchema);
