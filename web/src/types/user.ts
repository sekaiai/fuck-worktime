export interface UserInfo {
  userId: string;
  nickname: string;
  phone: string;
  deptName: string;
  avatar: string;
}

export interface UserAuthState {
  userId: string | null;
  token: string | null;
  userInfo: UserInfo | null;
  isAuthenticated: boolean;
}
