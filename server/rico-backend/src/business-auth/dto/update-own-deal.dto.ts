import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateOwnDealDto {
  @IsOptional()
  @IsString()
  titleAr?: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsOptional()
  @IsIn(['expired'])
  status?: string;
}
