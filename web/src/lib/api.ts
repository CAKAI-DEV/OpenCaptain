/**
 * @deprecated Import from '@/lib/api.server' for Server Components
 *             or '@/lib/api.client' for Client Components
 */

// Re-export client utilities
export { clientApiClient } from './api.client';
// Re-export server utilities for backward compatibility
// WARNING: This file uses 'next/headers' and can only be used in Server Components
export { ApiError, AuthError, apiClient } from './api.server';
