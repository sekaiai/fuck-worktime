import { IsString } from 'class-validator';

export class GetUserQueryDto {
  @IsString()
  userId!: string;
}

export class GetUserByPhoneQueryDto {
  @IsString()
  phone!: string;
}

export type DingtalkLoginStatus = 'logged_in' | 'refreshing' | 'expired';

export interface UserInfoData {
  userId: string;
  token: string | null;
  nickname: string;
  phone: string;
  department: string;
  updatedAt: string;
  status: DingtalkLoginStatus;
}
