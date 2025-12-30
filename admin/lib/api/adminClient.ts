const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export class AdminApiError extends Error {
  status: number;
  body: any;

  constructor(message: string, status: number, body?: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';');
  const csrfCookie = cookies.find(c =>
    c.trim().startsWith('csrf_token=')
  );
  return csrfCookie ? csrfCookie.split('=')[1] : null;
}

export async function adminApiClient<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = options.method?.toUpperCase() || 'GET';

  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(method !== 'GET' && { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) {
      (headers as Record<string, string>)['X-CSRF-Token'] = csrf;
    }
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    // Handle 401 Unauthorized - redirect to login
    if (res.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login';
      // Return a rejected promise to prevent further execution
      return Promise.reject(new AdminApiError('Unauthorized', 401));
    }

    let body = null;
    try {
      body = await res.json();
    } catch {}

    throw new AdminApiError(
      body?.error?.detail || body?.error?.message || `HTTP ${res.status}`,
      res.status,
      body
    );
  }

  return res.status === 204 ? (null as T) : res.json();
}
