import mongoose from 'mongoose';

// Token is stored HASHED (sha256), never in plaintext — see lib/auth.js. If
// the DB ever leaks, these rows aren't directly usable as credentials.
// expiresAt has a TTL index (expireAfterSeconds: 0) so Mongo purges expired
// tokens on its own — no cron job needed, unlike the D1/Workers version.
const magicLinkTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessAccount', required: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
}, { timestamps: true });

magicLinkTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('MagicLinkToken', magicLinkTokenSchema);
