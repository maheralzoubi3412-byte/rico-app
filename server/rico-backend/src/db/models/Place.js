import mongoose from 'mongoose';

// location uses MongoDB's native geospatial support (2dsphere) — this
// replaces the geohash + bbox-prefilter workaround the D1 version needed
// (D1 has no geo index). $near queries handle both the radius filter and
// distance sort in one step.
const placeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameAr: { type: String, default: null },
  categorySlug: { type: String, required: true, index: true },
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  city: { type: String, default: null },
  district: { type: String, default: null },
  address: { type: String, default: null },
  phone: { type: String, default: null },
  openingHours: { type: String, default: null },
  priceLevel: { type: Number, min: 1, max: 4, default: null },
  rating: { type: Number, min: 0, max: 5, default: null },
  ratingCount: { type: Number, default: null },
  enrichmentSource: { type: String, default: null },
  // (source, sourceId) replaces the separate place_source_links table from
  // the D1 schema — Mongo's flexible schema lets this live directly on the
  // place doc as an array instead of a join table.
  sourceLinks: [
    {
      source: { type: String, required: true }, // osm | google | manual | partner
      sourceId: { type: String, required: true },
    },
  ],
}, { timestamps: true });

placeSchema.index({ location: '2dsphere' });
placeSchema.index({ 'sourceLinks.source': 1, 'sourceLinks.sourceId': 1 });

export default mongoose.model('Place', placeSchema);
