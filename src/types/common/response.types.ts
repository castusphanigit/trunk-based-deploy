export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string
}

export interface ErrorResponse {
  success: false;
  error: string;
  message?: string
}

export interface SuccessResponse<T> {
  success: true;
  data: T
}
