export interface StoredUser {
  phone: string;
  nickname: string;
  authorization: string;
  updateTime: string;
}

export interface UserProfile {
  phone: string;
  nickname: string;
}

export interface SaveAuthResponse {
  success: boolean;
  message: string;
  data?: UserProfile;
}
