import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OwnerAccountDocument = HydratedDocument<OwnerAccount>;
export const OWNER_ROLES = ['owner', 'staff'] as const;
export type OwnerRole = (typeof OWNER_ROLES)[number];

@Schema({ timestamps: true })
export class OwnerAccount {
  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, required: true })
  passwordHash: string;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;

  // 'owner' can manage staff accounts; 'staff' has identical dashboard
  // access otherwise. The first-boot bootstrap account is always 'owner'.
  @Prop({ type: String, required: true, enum: OWNER_ROLES, default: 'owner' })
  role: OwnerRole;

  // Soft-disable instead of deletion — keeps audit-log/attribution history
  // intact for a departed staff member instead of orphaning it.
  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const OwnerAccountSchema = SchemaFactory.createForClass(OwnerAccount);
