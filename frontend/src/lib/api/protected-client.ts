import { apiClient } from "./client";

/**
 * Wrapper for API calls that require authentication.
 * Automatically sets requiresAuth flag.
 */
export async function protectedApiClient<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    requiresAuth: true,
  });
}
