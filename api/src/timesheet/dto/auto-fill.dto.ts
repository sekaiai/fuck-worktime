import { IsString, IsNumber, IsBoolean, IsOptional, IsDateString } from 'class-validator';

export class SaveAutoFillDto {
  @IsString()
  userId!: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  projectId!: string;

  @IsString()
  projectTitle!: string;

  @IsNumber()
  projectStatus!: number;

  @IsString()
  itemId!: string;

  @IsString()
  itemName!: string;

  @IsNumber()
  hours!: number;

  @IsString()
  @IsOptional()
  work!: string;

  @IsDateString()
  @IsOptional()
  deadline?: string | null;
}

export class GetAutoFillQueryDto {
  @IsString()
  userId!: string;
}
