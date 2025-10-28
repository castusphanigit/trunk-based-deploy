export interface PaginationParams {
  page?: number | string;
  perPage?: number | string
}

export interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number
}

export function getPagination(params: PaginationParams = {}) {
  const page = Math.max(Number(params.page) || 1, 1);
  const perPage = Math.max(Number(params.perPage) || 20, 1);
  const skip = (page - 1) * perPage;
  const take = perPage;
  return { page, perPage, skip, take };
}

export function getPaginationMeta(
  total: number,
  page: number,
  perPage: number
): PaginationMeta {
  return {
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}
