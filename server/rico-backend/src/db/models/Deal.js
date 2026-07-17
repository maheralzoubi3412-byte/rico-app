import mongoose from 'mongoose';

const dealSchema = new mongoose.Schema({
  placeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Place', required: true, index: true },
  titleAr: { type: String, required: true },
  descriptionAr: { type: String, default: null },
  dealType: {
    type: String,
    required: true,
    enum: ['percent', 'fixed', 'bogo', 'free_item', 'bundle'],
  },
  value: { type: Number, default: null },
  currency: { type: String, default: 'SAR' },
  promoCode: { type: String, default: null },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
  activeDays: { type: [String], default: null }, // e.g. ['fri','sat']
  activeTime: {
    from: { type: String, default: null }, // 'HH:MM'
    to: { type: String, default: null },
  },
  status: {
    type: String,
    required: true,
    default: 'active',
    enum: ['active', 'pending_review', 'expired', 'rejected'],
    index: true,
  },
  // manual | google | partner_selfserve | business_dashboard | aggregator
  source: { type: String, required: true },
  sourceRef: { type: String, default: null },
  verifiedAt: { type: Date, default: null },
  // set only for source='business_dashboard' deals — lets a claim suspension
  // cascade to hide exactly this business's deals (see BusinessPlaceLink).
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessAccount', default: null },
}, { timestamps: true });

export default mongoose.model('Deal', dealSchema);
