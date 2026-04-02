import { Transform } from 'class-transformer';

export class SaveAuthDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : '',
  )
  token!: string;
}
