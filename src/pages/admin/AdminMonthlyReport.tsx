// Informe mensual administrativo.
// Se ve en /admin/informe-mensual y calcula ingresos del mes con entradas activas/canceladas.
import React from 'react';
import { useData } from '../../context/DataContext';

// Devuelve el mes actual en formato YYYY-MM para filtrar entradas.
const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

// Formatea valores numericos como pesos colombianos.
const money = (value: number) => value.toLocaleString('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

// Componente del informe mensual; resume entradas activas y canceladas del mes.
export const AdminMonthlyReport: React.FC = () => {
  // Entradas financieras guardadas por DataContext.
  const { occupancyEntries } = useData();
  // Filtros y totales que se ven en tarjetas y tablas del informe mensual.
  const month = currentMonth();
  const activeEntries = occupancyEntries.filter((entry) => entry.date.startsWith(month) && entry.status === 'Activa');
  const canceledEntries = occupancyEntries.filter((entry) => entry.canceledAt?.startsWith(month));
  const total = activeEntries.reduce((sum, entry) => sum + entry.price, 0);
  const canceledTotal = canceledEntries.reduce((sum, entry) => sum + entry.price, 0);

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>Informe Mensual</h2>
        <p>Resumen de entradas ocupadas y canceladas del mes {month}.</p>
      </div>

      {/* Tarjetas resumen del mes. */}
      <div className="admin-grid">
        <div className="stat-card report-card">
          <div className="stat-icon">💰</div>
          <div>
            <h3>Total mensual</h3>
            <p className="stat-number">{money(total)}</p>
          </div>
        </div>
        <div className="stat-card report-card">
          <div className="stat-icon">🏨</div>
          <div>
            <h3>Entradas activas</h3>
            <p className="stat-number">{activeEntries.length}</p>
          </div>
        </div>
        <div className="stat-card report-card">
          <div className="stat-icon">❌</div>
          <div>
            <h3>Canceladas</h3>
            <p className="stat-number">{money(canceledTotal)}</p>
          </div>
        </div>
      </div>

      {/* Tabla visible de entradas activas del mes. */}
      <div className="admin-card">
        <h3>Entradas activas del mes</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Habitacion</th>
                <th>Huesped</th>
                <th>Tipo</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {activeEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.date}</td>
                  <td>{entry.roomNumber}</td>
                  <td>{entry.guestName}</td>
                  <td>{entry.clientType}</td>
                  <td>{money(entry.price)}</td>
                </tr>
              ))}
              {!activeEntries.length ? (
                <tr><td colSpan={5}>No hay entradas activas para este mes.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabla visible de entradas canceladas del mes. */}
      <div className="admin-card">
        <h3>Entradas canceladas del mes</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Cancelada</th>
                <th>Habitacion</th>
                <th>Huesped</th>
                <th>Valor eliminado</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {canceledEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.canceledAt}</td>
                  <td>{entry.roomNumber}</td>
                  <td>{entry.guestName}</td>
                  <td>{money(entry.price)}</td>
                  <td>{entry.cancellationReason}</td>
                </tr>
              ))}
              {!canceledEntries.length ? (
                <tr><td colSpan={5}>No hay entradas canceladas para este mes.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
