export interface User {
  id: string;
  email: string;
  orgId: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
