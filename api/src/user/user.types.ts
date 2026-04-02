export interface StoredUser {
  phone: string;
  nickname: string;
  authorization: string;
  updateTime: string;
  status: 'active' | 'expired';
}

export interface UserProfile {
  phone: string;
  nickname: string;
  status: 'active' | 'expired';
}

export interface SaveAuthResponse {
  success: boolean;
  message: string;
  data?: UserProfile;
}

export interface UserLookupResponse {
  success: boolean;
  message: string;
  data?: UserProfile;
}
