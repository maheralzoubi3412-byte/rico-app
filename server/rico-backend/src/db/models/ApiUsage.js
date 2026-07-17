import mongoose from 'mongoose';

// Calendar-month usage counter for paid external APIs (currently just Google
// Places), keyed generically by `provider` so any future paid source reuses
// this — ported as-is from the D1 version.
const apiUsageSchema = new mongoose.Schema({
  provider: { type: String, required: true },
  period: { type: String, required: true }, // 'YYYY-MM' (UTC)
  requestCount: { type: Number, default: 0 },
});

apiUsageSchema.index({ provider: 1, period: 1 }, { unique: true });

export default mongoose.model('ApiUsage', apiUsageSchema);
