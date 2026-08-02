import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type MagicLinkTokenDocument = HydratedDocument<MagicLinkToken>;

// Token stored HASHED (sha256), never in plaintext — see auth.util.ts.
// expiresAt has a TTL index (expireAfterSeconds: 0) so Mongo purges expired
// tokens on its own.
@Schema({ timestamps: true })
export class MagicLinkToken {
  @Prop({ type: String, required: true, unique: true })
  tokenHash: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'BusinessAccount', required: true })
  businessId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  usedAt: Date | null;
}

export const MagicLinkTokenSchema = SchemaFactory.createForClass(MagicLinkToken);
MagicLinkTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
