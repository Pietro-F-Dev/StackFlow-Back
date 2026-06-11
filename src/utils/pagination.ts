const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parsePagination(query: { page?: unknown; limit?: unknown }): Pagination {
  const page = Math.max(1, toPositiveInt(query.page, DEFAULT_PAGE));
  const limit = Math.min(MAX_LIMIT, Math.max(1, toPositiveInt(query.limit, DEFAULT_LIMIT)));
  return { page, limit, skip: (page - 1) * limit };
}

export function buildPaginatedResult<T>(data: T[], total: number, pagination: Pagination): PaginatedResult<T> {
  return {
    data,
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / pagination.limit),
  };
}
