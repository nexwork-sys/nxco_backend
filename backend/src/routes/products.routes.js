const express = require('express');
const Product = require('../models/Product');
const { requireLogin, requireRole, sendJson } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireLogin);

// GET /api/products — any logged-in role (Marketing/Driver need it to build order/delivery views)
router.get(
    '/',
    asyncHandler(async (req, res) => {
        const products = await Product.find().sort({ brand_name: 1, product_name: 1 });
        sendJson(res, true, '', { products });
    })
);

// Admin or Supervisor/Manager/Operator manage inventory.
const canManage = requireRole('Admin', 'Supervisor', 'Manager', 'Operator');

router.post(
    '/',
    canManage,
    asyncHandler(async (req, res) => {
        const { brand_name, product_name, quantity, rate } = req.body || {};
        if (!brand_name || !product_name) {
            return sendJson(res, false, 'Brand and product name are required.', {}, 422);
        }
        const product = await Product.create({
            brand_name: brand_name.trim(),
            product_name: product_name.trim(),
            quantity: Math.max(0, Number(quantity) || 0),
            rate: rate !== undefined && rate !== '' ? Number(rate) : null,
        });
        sendJson(res, true, 'Product added.', { id: product._id });
    })
);

router.post(
    '/:id/update',
    canManage,
    asyncHandler(async (req, res) => {
        const product = await Product.findById(req.params.id);
        if (!product) return sendJson(res, false, 'Product not found.', {}, 404);

        const { brand_name, product_name, quantity, rate } = req.body || {};
        if (brand_name) product.brand_name = brand_name.trim();
        if (product_name) product.product_name = product_name.trim();
        if (quantity !== undefined) product.quantity = Math.max(0, Number(quantity) || 0);
        if (rate !== undefined) product.rate = rate === '' ? null : Number(rate);

        await product.save();
        sendJson(res, true, 'Product updated.');
    })
);

// POST /api/products/:id/add-stock — adds the given quantity on top of the
// current stock (e.g. a new delivery arrives), rather than overwriting it
// like /:id/update does.
router.post(
    '/:id/add-stock',
    canManage,
    asyncHandler(async (req, res) => {
        const addQty = Number(req.body?.quantity);
        if (!Number.isFinite(addQty) || addQty <= 0) {
            return sendJson(res, false, 'Enter a valid quantity to add.', {}, 422);
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { $inc: { quantity: Math.floor(addQty) } },
            { new: true }
        );
        if (!product) return sendJson(res, false, 'Product not found.', {}, 404);

        sendJson(res, true, 'Stock updated.', { quantity: product.quantity });
    })
);

router.post(
    '/:id/delete',
    requireRole('Admin'),
    asyncHandler(async (req, res) => {
        const product = await Product.findById(req.params.id);
        if (!product) return sendJson(res, false, 'Product not found.', {}, 404);
        await product.deleteOne();
        sendJson(res, true, 'Product deleted.');
    })
);

module.exports = router;
