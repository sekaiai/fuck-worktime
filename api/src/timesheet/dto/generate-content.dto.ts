import { IsInt, IsString, Max, Min, IsOptional } from 'class-validator';

export class GenerateContentDto {
  @IsInt()
  @Min(1)
  @Max(7)
  dayCount!: number;

  @IsInt()
  @Min(50)
  @Max(200)
  @IsOptional()
  maxChars?: number = 200;

  @IsString()
  description!: string;
}
