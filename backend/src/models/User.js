const mongoose = require('mongoose');

// Roles mirror the original PHP app exactly — Admin has full access,
// Marketing does field sales + attendance-at-party, Supervisor/Manager/Operator
// run the same "Operations" dashboard, Driver handles deliveries.
const ROLES = ['Admin', 'Marketing', 'Supervisor', 'Manager', 'Operator', 'Driver'];

const userSchema = new mongoose.Schema(
    {
        employee_id: { type: String, required: true, unique: true, trim: true },
        name: { type: String, required: true, trim: true },
        mobile: { type: String, required: true, trim: true },
        designation: { type: String, required: true, trim: true },
        role: { type: String, required: true, enum: ROLES },
        password_hash: { type: String, required: true },
        active: { type: Boolean, default: true },
        // Last-known live location, updated by attendance check-in and the
        // periodic location-ping while checked in — powers Live Tracking.
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
        location_updated_at: { type: Date, default: null },
    },
    { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
    return {
        id: this._id,
        employee_id: this.employee_id,
        name: this.name,
        mobile: this.mobile,
        designation: this.designation,
        role: this.role,
        active: this.active,
    };
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
