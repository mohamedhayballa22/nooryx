const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

interface FetchOptions extends RequestInit {
  // Optionally override automatic JSON parsing
  rawResponse?: boolean;
  // Internal flag to prevent infinite JWT token refresh loops
  _isRetry?: boolean;
  // Flag to indicate if this request requires auth (protected route)
  requiresAuth?: boolean;
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

// Get CSRF token from cookies
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  const csrfCookie = cookies.find(c => c.trim().startsWith('csrf_token='));
  
  if (!csrfCookie) return null;
  
  return csrfCookie.split('=')[1];
}

// Attempt to refresh the access token (and CSRF token)
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/auth/sessions/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // The refresh endpoint sets both new access token AND new CSRF token in cookies
    return response.ok;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
}

// Redirect to login page
function redirectToLogin() {
  // Only redirect if we're in a protected route
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    const isProtectedRoute = pathname.startsWith('/core');
    const isLoginPage = pathname === '/login';
    
    // Only redirect if we're in a protected route and not already on login
    if (isProtectedRoute && !isLoginPage) {
      window.location.href = '/login';
    }
  }
}

// Handle 401 errors with token refresh and retry
async function handle401<T>(
  endpoint: string,
  options: FetchOptions
): Promise<T> {
  const { requiresAuth } = options;

  // If we're already refreshing, wait for that to complete
  if (isRefreshing && refreshPromise) {
    const refreshSuccess = await refreshPromise;
    if (refreshSuccess) {
      // Retry the original request
      return apiClient(endpoint, { ...options, _isRetry: true });
    } else {
      // Refresh failed - only redirect if this was an authenticated request
      if (requiresAuth) {
        redirectToLogin();
      }
      throw new ApiError('Authentication failed', 401);
    }
  }

  // Start refresh process
  isRefreshing = true;
  refreshPromise = refreshAccessToken();

  try {
    const refreshSuccess = await refreshPromise;

    if (refreshSuccess) {
      // Retry the original request with new tokens
      const result = await apiClient<T>(endpoint, { ...options, _isRetry: true });
      return result;
    } else {
      // Refresh failed - only redirect if this was an authenticated request
      if (requiresAuth) {
        redirectToLogin();
      }
      throw new ApiError('Authentication failed', 401);
    }
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

// Handle 403 CSRF errors with token refresh and retry
async function handle403Csrf<T>(
  endpoint: string,
  options: FetchOptions,
  errorBody: any
): Promise<T> {
  const { _isRetry } = options;

  // If this is already a retry, don't try again to prevent infinite loops
  if (_isRetry) {
    throw new ApiError(
      'CSRF token validation failed after refresh. Please reload the page.',
      403,
      errorBody
    );
  }

  // If we're already refreshing, wait for that to complete
  if (isRefreshing && refreshPromise) {
    const refreshSuccess = await refreshPromise;
    if (refreshSuccess) {
      // Retry the original request with fresh CSRF token
      return apiClient(endpoint, { ...options, _isRetry: true });
    } else {
      throw new ApiError(
        'Unable to refresh CSRF token. Please reload the page.',
        403,
        errorBody
      );
    }
  }

  // Start refresh process - this will get us a new CSRF token
  isRefreshing = true;
  refreshPromise = refreshAccessToken();

  try {
    const refreshSuccess = await refreshPromise;

    if (refreshSuccess) {
      // The refresh endpoint has set a new CSRF token cookie
      // Retry the original request
      const result = await apiClient<T>(endpoint, { ...options, _isRetry: true });
      return result;
    } else {
      throw new ApiError(
        'Unable to refresh CSRF token. Please reload the page.',
        403,
        errorBody
      );
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
  const { rawResponse, headers, _isRetry, requiresAuth, ...fetchOptions } = options;

  // Prepare headers with CSRF token for state-changing methods
  const requestHeaders: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...headers,
  };

  // Add CSRF token for state-changing methods (POST, PUT, PATCH, DELETE)
  const method = fetchOptions.method?.toUpperCase() || 'GET';
  const requiresCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  
  if (requiresCsrf) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      (requestHeaders as Record<string, string>)['X-CSRF-Token'] = csrfToken;
    }
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    credentials: 'include',
    headers: requestHeaders,
    ...fetchOptions,
  });

  if (!response.ok) {
    const errorBody = await safeJson(response);

    // Handle 401 errors with refresh logic (but not if this is already a retry)
    if (response.status === 401 && !_isRetry) {
      return handle401<T>(endpoint, options);
    }

    // If we get here with a 401 after retry, only redirect if auth was required
    if (response.status === 401 && _isRetry && requiresAuth) {
      redirectToLogin();
    }

    // Handle CSRF errors with token refresh
    if (response.status === 403 && errorBody?.error?.type === 'csrf_error') {
      return handle403Csrf<T>(endpoint, options, errorBody);
    }

    throw new ApiError(
      errorBody?.error?.detail || errorBody?.error?.message || `HTTP error ${response.status}`,
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
