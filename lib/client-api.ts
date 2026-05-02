type JsonObject = Record<string, unknown>;

function isJsonContentType(contentType: string | null) {
  return !!contentType && contentType.toLowerCase().includes('application/json');
}

function looksLikeHtml(text: string) {
  return /<!doctype html|<html/i.test(text);
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;

  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?error=session_expired&next=${encodeURIComponent(next)}`);
}

function extractJsonError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;

  const error = (payload as JsonObject).error;
  return typeof error === 'string' && error.trim().length > 0 ? error : null;
}

async function readErrorMessage(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get('content-type');

  if (isJsonContentType(contentType)) {
    try {
      const payload = await response.json();
      return extractJsonError(payload) || fallbackMessage;
    } catch {
      return fallbackMessage;
    }
  }

  const text = await response.text();
  if (response.status === 401 || response.status === 403 || looksLikeHtml(text)) {
    redirectToLogin();
    return 'Sesi login berubah. Silakan login ulang.';
  }

  return fallbackMessage;
}

export async function fetchJsonOrThrow<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackMessage = 'Permintaan gagal.'
): Promise<T> {
  const response = await fetch(input, init);
  const contentType = response.headers.get('content-type');

  if (!response.ok) {
    const message = await readErrorMessage(response, fallbackMessage);
    throw new Error(message);
  }

  if (!isJsonContentType(contentType)) {
    const text = await response.text();
    if (looksLikeHtml(text)) {
      redirectToLogin();
      throw new Error('Sesi login berubah. Silakan login ulang.');
    }

    throw new Error(fallbackMessage);
  }

  try {
    return await response.json();
  } catch {
    throw new Error('Response server tidak valid. Silakan refresh halaman.');
  }
}

export async function fetchBlobOrThrow(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackMessage = 'Permintaan gagal.'
) {
  const response = await fetch(input, init);

  if (!response.ok) {
    const message = await readErrorMessage(response, fallbackMessage);
    throw new Error(message);
  }

  return response.blob();
}
