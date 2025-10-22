const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FetchOptions extends RequestInit {
  // Optionally override automatic JSON parsing
  rawResponse?: boolean;
  // Internal flag to prevent infinite refresh loops
  _isRetry?: boolean;
}

// Custom error class that preserves HTTP status
export class ApiError extends Error {
  status: number;
  body: any;

  constructor(message: string, status: number, body?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// Token refresh state management
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// Attempt to refresh the access token
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/auth/sessions/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
}

// Handle 401 errors with token refresh and retry
async function handle401<T>(
  endpoint: string,
  options: FetchOptions
): Promise<T> {
  // Don't attempt refresh for auth endpoints themselves
  const isAuthEndpoint = endpoint.startsWith('/auth/');
  
  if (isAuthEndpoint) {
    throw new ApiError('Authentication required', 401);
  }

  // If we're already refreshing, wait for that to complete
  if (isRefreshing && refreshPromise) {
    const refreshSuccess = await refreshPromise;
    if (refreshSuccess) {
      // Retry the original request
      return apiClient(endpoint, { ...options, _isRetry: true });
    } else {
      // Refresh failed, just throw the error without redirecting
      throw new ApiError('Authentication failed', 401);
    }
  }

  // Start refresh process
  isRefreshing = true;
  refreshPromise = refreshAccessToken();

  try {
    const refreshSuccess = await refreshPromise;

    if (refreshSuccess) {
      // Retry the original request
      const result = await apiClient<T>(endpoint, { ...options, _isRetry: true });
      return result;
    } else {
      // Refresh failed, just throw the error without redirecting
      throw new ApiError('Authentication failed', 401);
    }
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

// Unified API client built on top of fetch().
// Automatically prefixes BASE_URL, handles errors, and parses JSON.
export async function apiClient<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { rawResponse, headers, _isRetry, ...fetchOptions } = options;

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    credentials: 'include', // Always include cookies for HttpOnly auth
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    ...fetchOptions,
  });

  if (!response.ok) {
    const errorBody = await safeJson(response);

    // Handle 401 errors with refresh logic (but not if this is already a retry)
    if (response.status === 401 && !_isRetry) {
      return handle401<T>(endpoint, options);
    }

    // If we get here with a 401 after retry, DON'T redirect
    // Let the calling code handle it (auth context will handle redirects)
    throw new ApiError(
      errorBody?.message || `HTTP error ${response.status}`,
      response.status,
      errorBody
    );
  }

  return rawResponse ? (response as any) : safeJson(response);
}

// Safely parse JSON (returns null if empty or invalid).
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
