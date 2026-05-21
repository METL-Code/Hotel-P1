const parseResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || 'Error en el backend');
  }
  return data as T;
};

export const apiGet = async <T>(path: string) => {
  const response = await fetch(path);
  return parseResponse<T>(response);
};

export const apiSend = async <T>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown) => {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return parseResponse<T>(response);
};
