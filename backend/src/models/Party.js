const mongoose = require('mongoose');

const partySchema = new mongoose.Schema(
    {
        party_name: { type: String, required: true, trim: true },
        owner_name: { type: String, required: true, trim: true },
        mobile: { type: String, required: true, trim: true },
        water_brand: { type: String, default: '' },
        years_exp: { type: Number, default: 0 },
        // Which vehicle types can reach this shop. Replaces the old single
        // truck_accessible boolean — a shop can be reachable by more than
        // one vehicle type (e.g. both truck and pickup).
        vehicle_types: {
            type: [String],
            enum: ['truck', 'pickup', 'magic', 'auto', 'toto'],
            default: [],
        },
        area: { type: String, default: '' },
        city: { type: String, default: '' },
        address: { type: String, default: '' },
        shop_image: { type: String, default: null }, // relative path under /uploads
        owner_image: { type: String, default: null }, // relative path under /uploads
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

        // A party a Marketing employee adds isn't usable (can't be ordered
        // for, doesn't get a journey-plan slot) until Admin/Manager approves
        // it. Parties Admin/Manager add themselves are auto-approved.
        status: { type: String, enum: ['Pending', 'Approved'], default: 'Pending' },
        approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        approved_at: { type: Date, default: null },

        // "Fill Form" — the commercial/KYC details filled in once a party is
        // approved, before Marketing can place an order for it: ID numbers, and this specific party's
        // negotiated rate for each product.
        // NOTE: Cash / Credit and the cheque (number + photo) are NOT part of
        // the Fill Form any more — they are chosen on each order.
        aadhar_no: { type: String, default: '' },
        aadhar_image: { type: String, default: null }, // relative path under /uploads
        pan_no: { type: String, default: '' },
        pan_image: { type: String, default: null }, // relative path under /uploads
        gst_no: { type: String, default: '' }, // optional either way
        form_no: { type: String, default: '' },
        comment: { type: String, default: '' },
        product_rates: {
            type: [
                new mongoose.Schema(
                    { product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, rate: { type: Number, required: true, min: 0 } },
                    { _id: false }
                ),
            ],
            default: [],
        },
        fill_form_completed: { type: Boolean, default: false },
    },
    { timestamps: true }
);

const VEHICLE_ICONS = { truck: '🚛', pickup: '🛻', magic: '🚐', auto: '🛺', toto: '🛺⚡' };

partySchema.methods.toJSONWithIcon = function toJSONWithIcon() {
    const obj = this.toJSON();
    const types = obj.vehicle_types || [];
    obj.truck_icon = types.length ? types.map(t => VEHICLE_ICONS[t] || '').join(' ') : '🚫';
    return obj;
};

module.exports = mongoose.model('Party', partySchema);
