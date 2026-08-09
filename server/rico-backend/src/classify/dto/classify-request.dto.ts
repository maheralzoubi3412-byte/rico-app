import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';

export class HistoryMessageDto {
  @IsIn(['user', 'assistant'])
  role: string;

  @IsString()
  @Length(1, 300)
  content: string;
}

class LastShownItemDto {
  @IsInt()
  @Min(1)
  @Max(10)
  position: number;

  @IsString()
  @Length(1, 120)
  name: string;
}

export class LastResultsDto {
  @IsString()
  @Length(1, 40)
  label: string;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => LastShownItemDto)
  items: LastShownItemDto[];
}

export class ClassifyRequestDto {
  @IsString()
  @Length(1, 500)
  message: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => HistoryMessageDto)
  history?: HistoryMessageDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => LastResultsDto)
  lastResults?: LastResultsDto;
}
