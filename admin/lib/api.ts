const NEXT_PUBLIC_API_URL = '/api';

export async function apiFetch(
  path: string,
  options: RequestInit = {}
) {
  const res = await fetch(
    `${NEXT_PUBLIC_API_URL}${path}`,
    {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.headers || {}),
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  return res;
}
