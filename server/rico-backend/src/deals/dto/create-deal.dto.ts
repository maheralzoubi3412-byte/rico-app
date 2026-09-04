import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const DEAL_TYPES = ['percent', 'fixed', 'bogo', 'free_item', 'bundle'] as const;

export class CreateDealDto {
  @IsMongoId()
  businessId: string;

  @IsString()
  @MaxLength(120)
  titleAr: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsIn(DEAL_TYPES)
  dealType: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  startsAt?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  endsAt?: number;

  @IsOptional()
  @IsArray()
  activeDays?: string[];

  @IsOptional()
  @IsObject()
  activeTime?: { from: string; to: string };

  @IsOptional()
  @IsString()
  sourceRef?: string;
}
