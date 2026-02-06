// Generic API response wrapper (matches backend createResponse)
export interface ApiResponse<T> {
  data: T;
}

// Paginated response (matches backend createPaginatedResponse)
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// API error response (RFC 7807)
export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}
