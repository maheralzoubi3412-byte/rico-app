import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Length, ValidateNested } from 'class-validator';

class HistoryMessageDto {
  @IsIn(['user', 'assistant'])
  role: string;

  @IsString()
  @Length(1, 300)
  content: string;
}

export class ClassifyRequestDto {
  @IsString()
  @Length(1, 500)
  message: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => HistoryMessageDto)
  history?: HistoryMessageDto[];
}
