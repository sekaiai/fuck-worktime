import { IsArray } from 'class-validator';

export class ReportBatchDto {
  @IsArray()
  workingTimingList!: Record<string, unknown>[];
}

export interface ReportBatchResponse {
  code: number;
  msg: string;
  data: unknown | null;
}
