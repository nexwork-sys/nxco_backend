const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
    {
        brand_name: { type: String, required: true, trim: true },
        product_name: { type: String, required: true, trim: true },
        quantity: { type: Number, required: true, default: 0, min: 0 },
        rate: { type: Number, default: null },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
