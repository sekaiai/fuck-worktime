export interface UserInfo {
  userId: string;
  nickname: string;
  phone: string;
  department?: string;
  deptName?: string;
  avatar?: string;
  statusText?: string;
}

export interface UserAuthState {
  userId: string | null;
  userInfo: UserInfo | null;
  isAuthenticated: boolean;
}
