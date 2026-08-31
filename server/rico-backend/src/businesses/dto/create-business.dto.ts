import { IsIn, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { CATEGORIES } from '../../classify/constants/classify.constants';

// Derived from the classifier's category list so a business can always be
// registered under any category the LLM is able to detect — this used to be
// a hand-maintained duplicate, which is the same pattern that let other
// category mirrors (e.g. some UI label maps) silently drift out of sync.
const CATEGORY_SLUGS = CATEGORIES;

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
