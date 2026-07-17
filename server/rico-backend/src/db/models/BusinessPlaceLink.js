import mongoose from 'mongoose';

// The "claim" — a business asserting ownership of a place. Gated by admin
// approval (status starts pending_review), same trust pattern as deals'
// self-serve submissions. Suspending an active claim should cascade to hide
// that business's deals for this place (see routes/admin.js).
const businessPlaceLinkSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessAccount', required: true },
  placeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Place', required: true },
  status: {
    type: String,
    required: true,
    default: 'pending_review',
    enum: ['pending_review', 'active', 'rejected', 'suspended'],
  },
}, { timestamps: true });

businessPlaceLinkSchema.index({ businessId: 1, placeId: 1 }, { unique: true });

export default mongoose.model('BusinessPlaceLink', businessPlaceLinkSchema);
