import { IsDateString, IsNotEmpty, IsNumber, IsString, MaxLength } from 'class-validator';

export class ReportDto {
  @IsDateString()
  reportDate!: string;

  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  projectTitle!: string;

  @IsNumber()
  projectStatus: number = 30;

  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsString()
  @MaxLength(200)
  content!: string;

  @IsNumber()
  hours!: number;
}
