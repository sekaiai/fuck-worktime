import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { ReportDto } from './report.dto';

export class ReportBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportDto)
  workingTimingList!: ReportDto[];
}
