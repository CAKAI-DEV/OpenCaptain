/**
 * Standardized API response types
 */

// Success response wrapper
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

// Paginated response
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

// Response metadata
export interface ResponseMeta {
  requestId?: string;
  timestamp?: string;
}

// Pagination metadata
export interface PaginationMeta extends ResponseMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Helper functions to create responses
export function createResponse<T>(data: T, meta?: Partial<ResponseMeta>): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  pagination: { page: number; limit: number; total: number },
  meta?: Partial<ResponseMeta>
): PaginatedResponse<T> {
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return {
    success: true,
    data,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}
