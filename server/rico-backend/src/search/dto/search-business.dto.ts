import { Type } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchBusinessDto {
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @Type(() => Number)
  @IsLongitude()
  lng: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50000)
  radius?: number = 3000;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsIn(['nearest', 'cheapest', 'best_rated'])
  rank?: string = 'nearest';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 8;
}
