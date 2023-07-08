export interface AuthUser {
  email: string;
  name?: string;
}

export interface WorklogFormData {
  from: string;
  to: string;
  comment: string;
}
