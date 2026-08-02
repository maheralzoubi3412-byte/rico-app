import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BusinessAccountDocument = HydratedDocument<BusinessAccount>;

@Schema({ timestamps: true })
export class BusinessAccount {
  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;
}

export const BusinessAccountSchema = SchemaFactory.createForClass(BusinessAccount);
