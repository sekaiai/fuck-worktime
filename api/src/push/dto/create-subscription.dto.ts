import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class SubscriptionKeysDto {
  @IsString()
  @IsNotEmpty()
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  auth!: string;
}

export class CreateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  endpoint!: string;

  @IsOptional()
  @IsNumber()
  expirationTime?: number | null;

  @IsObject()
  @ValidateNested()
  @Type(() => SubscriptionKeysDto)
  keys!: SubscriptionKeysDto;
}
