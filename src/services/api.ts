// Servicio unico para llamadas HTTP del frontend.
// Se usa desde AuthContext, AdminUsers y DataContext para comunicarse con backend/server.js.

// Controla si el frontend debe intentar usar la API real.
// Se activa con VITE_API_ENABLED=true en el archivo .env de la raiz.
export const isApiEnabled = () => import.meta.env.VITE_API_ENABLED === 'true';

// Tiempo maximo de espera para una peticion del frontend.
// Evita que el login se quede cargando si SQL Server o la API no responden.
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 8000);

// Agrega headers del usuario actual para que el backend pueda guardar auditoria.
const authHeaders = () => {
  const headers: Record<string, string> = {};

  try {
    const rawUser = localStorage.getItem('hotel_user');
    if (!rawUser) return headers;
    const user = JSON.parse(rawUser) as { id?: string; username?: string; role?: string };

    if (user.id) headers['X-User-Id'] = String(user.id);
    if (user.username) headers['X-Username'] = String(user.username);
    if (user.role) headers['X-User-Role'] = String(user.role);
  } catch {
    return headers;
  }

  return headers;
};

// Convierte una respuesta fetch en JSON tipado y detecta errores HTTP.
const parseResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  let data: unknown = {};

  // El backend debe responder JSON; si responde texto roto se muestra error claro.
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Respuesta invalida del backend');
  }

  // Si el backend responde 400/401/500, usamos su mensaje de error.
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || 'Error en el backend');
  }
  return data as T;
};

// Wrapper central de fetch con timeout.
// Aqui se ve el comportamiento comun de todas las peticiones API.
const apiRequest = async <T>(path: string, init?: RequestInit) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const headers = new Headers(init?.headers);

  Object.entries(authHeaders()).forEach(([key, value]) => {
    headers.set(key, value);
  });

  try {
    const response = await fetch(path, {
      ...init,
      headers,
      signal: controller.signal
    });
    return parseResponse<T>(response);
  } catch (error) {
    // Mensaje que AuthContext usa para caer al login local temporal.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La API no respondio a tiempo');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

// GET para leer datos. Ejemplo visible: DataContext pide /api/rooms.
export const apiGet = async <T>(path: string) => {
  return apiRequest<T>(path);
};

// POST/PUT/PATCH/DELETE para enviar cambios. Ejemplo visible: crear habitaciones o login.
export const apiSend = async <T>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown) => {
  return apiRequest<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
};