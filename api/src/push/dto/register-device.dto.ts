import { IsNotEmpty, IsOptional, IsString, IsEnum, IsArray } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  cid!: string;

  @IsEnum(['android', 'ios', 'web'])
  platform!: 'android' | 'ios' | 'web';

  @IsOptional()
  @IsString()
  userId?: string;
}
