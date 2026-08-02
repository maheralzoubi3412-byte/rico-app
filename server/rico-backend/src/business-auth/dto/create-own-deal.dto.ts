import { IsIn, IsMongoId, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { DEAL_TYPES } from '../../deals/dto/create-deal.dto';

export class CreateOwnDealDto {
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
  promoCode?: string;
}
