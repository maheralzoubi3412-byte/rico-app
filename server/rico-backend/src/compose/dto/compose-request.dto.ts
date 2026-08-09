import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { HistoryMessageDto } from '../../classify/dto/classify-request.dto';

class ComposeItemDto {
  @IsString()
  @Length(1, 120)
  name: string;

  @IsOptional()
  @IsNumber()
  distanceMeters?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  priceLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsInt()
  ratingCount?: number;

  @IsOptional()
  @IsBoolean()
  openNow?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  dealLabel?: string;
}

export class ComposeRequestDto {
  @IsString()
  @Length(1, 500)
  message: string;

  @IsIn(['place', 'deals'])
  intentKind: string;

  @IsString()
  @Length(1, 60)
  intentLabel: string;

  @IsIn(['nearest', 'cheapest', 'open_now', 'best_rated'])
  rank: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ComposeItemDto)
  items: ComposeItemDto[];

  @IsBoolean()
  truncated: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => HistoryMessageDto)
  history?: HistoryMessageDto[];
}
