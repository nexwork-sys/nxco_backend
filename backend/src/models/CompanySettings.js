const mongoose = require('mongoose');

// Singleton — there is only ever one settings document. get() creates a
// default one on first access so callers never have to null-check.
const companySettingsSchema = new mongoose.Schema(
    {
        company_lat: { type: Number, default: 0 },
        company_lng: { type: Number, default: 0 },
        allowed_radius_meters: { type: Number, default: 200 },
        logo_path: { type: String, default: null },
    },
    { timestamps: true }
);

companySettingsSchema.statics.getSingleton = async function getSingleton() {
    let doc = await this.findOne();
    if (!doc) doc = await this.create({});
    return doc;
};

module.exports = mongoose.model('CompanySettings', companySettingsSchema);
