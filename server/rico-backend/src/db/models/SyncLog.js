import mongoose from 'mongoose';

// Prevents re-syncing the same area+category from Google before its data
// could plausibly have changed. Ported from D1's version, but upgraded to
// use a real geospatial query (native $near) instead of a coarse geohash
// prefix match — Mongo can just ask "any sync within N meters" directly.
const syncLogSchema = new mongoose.Schema({
  provider: { type: String, required: true },
  categorySlug: { type: String, required: true },
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  radiusMeters: { type: Number, required: true },
  syncedAt: { type: Date, default: Date.now },
});

syncLogSchema.index({ location: '2dsphere' });
syncLogSchema.index({ provider: 1, categorySlug: 1, syncedAt: 1 });

export default mongoose.model('SyncLog', syncLogSchema);
