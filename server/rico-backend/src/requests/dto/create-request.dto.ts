import { IsIn, IsMongoId, IsString, MaxLength } from 'class-validator';
import { REQUEST_ITEM_TYPES, RequestItemType } from '../schemas/request.schema';

export class CreateRequestDto {
  @IsMongoId()
  businessId: string;

  @IsString()
  @MaxLength(80)
  customerName: string;

  @IsString()
  @MaxLength(20)
  customerPhone: string;

  @IsIn(REQUEST_ITEM_TYPES)
  itemType: RequestItemType;

  @IsMongoId()
  itemId: string;
}
