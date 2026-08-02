import { IsIn, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

const CATEGORY_SLUGS = [
  'restaurant',
  'cafe',
  'pharmacy',
  'supermarket',
  'fuel',
  'mall',
  'atm',
  'bank',
  'hospital',
  'clinic',
  'fitness_centre',
] as const;

export { CATEGORY_SLUGS };

export class CreateBusinessDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsIn(CATEGORY_SLUGS)
  categorySlug: string;

  @IsOptional()
  @IsString()
  placeId?: string;

  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  openingHours?: string;

  @IsOptional()
  @IsNumber()
  priceLevel?: number;

  @IsOptional()
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsNumber()
  ratingCount?: number;
}
