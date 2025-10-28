export interface PaginationParams {
  page: number;
  perPage: number;
  skip: number;
  take: number
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number,
    perPage: number,
    total: number,
    totalPages: number
  }
}
