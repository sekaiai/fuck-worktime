import { IsString } from 'class-validator';

export class GetUserQueryDto {
  @IsString()
  userId!: string;
}

export class GetUserByPhoneQueryDto {
  @IsString()
  phone!: string;
}

export interface UserInfoData {
  userId: string;
  token: string;
  nickname: string;
  phone: string;
  department: string;
  updatedAt: string;
}
