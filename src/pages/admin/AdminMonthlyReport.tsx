import React from 'react';
import { useData } from '../../context/DataContext';

const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const money = (value: number) => value.toLocaleString('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

export const AdminMonthlyReport: React.FC = () => {
  const { occupancyEntries } = useData();
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
