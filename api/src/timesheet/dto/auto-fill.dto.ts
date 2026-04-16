import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class SaveAutoFillDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  projectTitle!: string;

  @IsNumber()
  @Min(0)
  projectStatus!: number;

  @IsString()
  @IsOptional()
  workTypeGroupId?: string;

  @IsString()
  @IsOptional()
  workTypeGroupName?: string;

  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsString()
  @IsNotEmpty()
  itemName!: string;

  @IsNumber()
  @Min(1)
  hours!: number;

  @IsString()
  @IsNotEmpty()
  work!: string;

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  reportTime?: string | null;

  @IsDateString()
  @IsOptional()
  deadline?: string | null;
}

export class GetAutoFillQueryDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
