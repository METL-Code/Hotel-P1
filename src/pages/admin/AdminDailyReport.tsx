// Informe diario administrativo.
// Se ve en /admin/informe-diario y calcula ingresos del dia con entradas activas/canceladas.
import React from 'react';
import { useData } from '../../context/DataContext';

// Devuelve la fecha del dia actual en formato YYYY-MM-DD.
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Formatea valores numericos como pesos colombianos.
const money = (value: number) => value.toLocaleString('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

// Componente del informe diario; usa occupancyEntries creadas al ocupar habitaciones.
export const AdminDailyReport: React.FC = () => {
  // Entradas activas/canceladas guardadas en DataContext.
  const { occupancyEntries } = useData();
  // Filtros y totales que se ven en tarjetas y tablas del informe diario.
  const reportDate = today();
  const activeEntries = occupancyEntries.filter((entry) => entry.date === reportDate && entry.status === 'Activa');
  const canceledEntries = occupancyEntries.filter((entry) => entry.canceledAt === reportDate);
  const total = activeEntries.reduce((sum, entry) => sum + entry.price, 0);
  const canceledTotal = canceledEntries.reduce((sum, entry) => sum + entry.price, 0);

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>Informe Diario</h2>
        <p>Entradas ocupadas y canceladas del dia {reportDate}.</p>
      </div>

      {/* Tarjetas resumen del dia. */}
      <div className="admin-grid">
        <div className="stat-card report-card">
          <div className="stat-icon">💰</div>
          <div>
            <h3>Total del dia</h3>
            <p className="stat-number">{money(total)}</p>
          </div>
        </div>
        <div className="stat-card report-card">
          <div className="stat-icon">🏨</div>
          <div>
            <h3>Habitaciones ocupadas</h3>
            <p className="stat-number">{activeEntries.length}</p>
          </div>
        </div>
        <div className="stat-card report-card">
          <div className="stat-icon">❌</div>
          <div>
            <h3>Entradas canceladas</h3>
            <p className="stat-number">{money(canceledTotal)}</p>
          </div>
        </div>
      </div>

      {/* Tabla visible de entradas activas del dia. */}
      <div className="admin-card">
        <h3>Entradas activas</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Habitacion</th>
                <th>Huesped</th>
                <th>Tipo</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {activeEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.roomNumber}</td>
                  <td>{entry.guestName}</td>
                  <td>{entry.clientType}</td>
                  <td>{money(entry.price)}</td>
                </tr>
              ))}
              {!activeEntries.length ? (
                <tr><td colSpan={4}>No hay entradas activas para este dia.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabla visible de entradas canceladas del dia. */}
      <div className="admin-card">
        <h3>Entradas canceladas</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Habitacion</th>
                <th>Huesped</th>
                <th>Valor eliminado</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {canceledEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.roomNumber}</td>
                  <td>{entry.guestName}</td>
                  <td>{money(entry.price)}</td>
                  <td>{entry.cancellationReason}</td>
                </tr>
              ))}
              {!canceledEntries.length ? (
                <tr><td colSpan={4}>No hay entradas canceladas para este dia.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
