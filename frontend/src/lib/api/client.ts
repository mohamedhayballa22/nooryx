const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FetchOptions extends RequestInit {
  // Optionally override automatic JSON parsing
  rawResponse?: boolean;
}

// Unified API client built on top of fetch().
// Automatically prefixes BASE_URL, handles errors, and parses JSON.
export async function apiClient<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { rawResponse, headers, ...fetchOptions } = options;

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    ...fetchOptions,
  });

  if (!response.ok) {
    const errorBody = await safeJson(response);
    const error = new Error(
      errorBody?.message || `HTTP error ${response.status}`
    );
    // Attach response info for debugging
    (error as any).status = response.status;
    (error as any).body = errorBody;
    throw error;
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
