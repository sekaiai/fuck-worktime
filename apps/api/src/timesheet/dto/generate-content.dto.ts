import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PreviousWeekContentDto {
  @IsString()
  @MaxLength(20)
  weekday!: string;

  @IsString()
  @MaxLength(2000)
  content!: string;
}

export class GenerateContentDto {
  @IsString()
  work!: string;

  @IsInt()
  @Min(1)
  @Max(7)
  days!: number;

  /** 按星期归并的上周填报内容；存在时启用上周参考生成模式。 */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => PreviousWeekContentDto)
  lastWeekContents?: PreviousWeekContentDto[];

  /** 本周待生成日期的星期，顺序与 AI 返回内容严格对应。 */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  targetWeekdays?: string[];
}
