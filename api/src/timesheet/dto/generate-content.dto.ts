import { IsInt, IsString, Max, Min } from 'class-validator';

export class GenerateContentDto {
  @IsString()
  work!: string;

  @IsInt()
  @Min(1)
  @Max(7)
  days!: number;
}
