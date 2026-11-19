// Utilidades compartidas de fechas y moneda para evitar duplicacion entre pantallas.

// Fecha local actual en formato YYYY-MM-DD (sin desfase UTC).
export const todayDate = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Mes local actual en formato YYYY-MM.
export const currentMonth = (): string => todayDate().slice(0, 7);

// Formatea valores monetarios en pesos colombianos.
export const formatMoney = (value: number): string =>
  value.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  });

// Convierte errores desconocidos en mensaje legible.
export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Error inesperado';
