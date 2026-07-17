import mongoose from 'mongoose';

const businessAccountSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('BusinessAccount', businessAccountSchema);
