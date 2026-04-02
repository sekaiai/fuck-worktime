import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

export class SaveTokenDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : '',
  )
  token!: string;
}
