import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type BusinessClaimDocument = HydratedDocument<BusinessClaim>;

// Renamed from BusinessPlaceLink — a BusinessAccount asserting ownership of
// a Business (location). Gated by admin approval (status starts
// pending_review). Suspending an active claim cascades to expire that
// account's deals for this business (see admin module).
@Schema({ timestamps: true })
export class BusinessClaim {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'BusinessAccount', required: true })
  accountId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Business', required: true })
  businessId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    default: 'pending_review',
    enum: ['pending_review', 'active', 'rejected', 'suspended'],
  })
  status: string;
}

export const BusinessClaimSchema = SchemaFactory.createForClass(BusinessClaim);
BusinessClaimSchema.index({ accountId: 1, businessId: 1 }, { unique: true });
