// Servicio unico para llamadas HTTP del frontend hacia backend/server.js.

const rawTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS);
const API_TIMEOUT_MS = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 10000;
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

const buildUrl = (path: string) => (API_BASE_URL && path.startsWith('/') ? `${API_BASE_URL}${path}` : path);

const parseResponse = async <T>(response: Response, path: string): Promise<T> => {
  const text = await response.text();
  let data: unknown = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Respuesta invalida del backend');
  }

  if (response.status === 401 && path !== '/api/auth/login') {
    localStorage.removeItem('hotel_user');
    localStorage.removeItem('hotel_token');
    window.dispatchEvent(new Event('hotel-auth-expired'));
  }

  if (!response.ok) {
    throw new Error((data as { error?: string }).error || 'Error en el backend');
  }
  return data as T;
};

const apiRequest = async <T>(path: string, init?: RequestInit) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const headers = new Headers(init?.headers);

  const token = localStorage.getItem('hotel_token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(buildUrl(path), {
      ...init,
      headers,
      signal: controller.signal
    });
    return await parseResponse<T>(response, path);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La API no respondio a tiempo');
    }
    if (error instanceof TypeError) {
      throw new Error('No se pudo conectar con el servidor backend. Verifica que este encendido.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const apiGet = async <T>(path: string) => apiRequest<T>(path);

export const apiSend = async <T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown
) => {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return apiRequest<T>(path, init);
};
