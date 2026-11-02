const mongoose = require('mongoose');

// Every model gets a consistent JSON shape: an `id` string virtual
// (mirroring Mongo's `_id`) and no internal `_id`/`__v` noise. The mobile
// app relies on `record.id` everywhere — selecting a party for an order,
// editing/deleting a product, etc. — so this must be registered before
// any model schema is compiled (this file is required first in
// server.js, ahead of the route/model files pulled in by app.js).
mongoose.plugin((schema) => {
    schema.set('toJSON', {
        virtuals: true,
        versionKey: false,
        transform: (_doc, ret) => {
            delete ret._id;
            return ret;
        },
    });
});

async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.');
    }
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri);
    console.log(`[db] Connected to MongoDB: ${mongoose.connection.name}`);
}

module.exports = connectDB;
