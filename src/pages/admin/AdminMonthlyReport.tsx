// Informe mensual administrativo.
// Se ve en /admin/informe-mensual y permite consultar cualquier mes desde SQL Server.
import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { currentMonth, formatMoney } from '../../utils/format';

export const AdminMonthlyReport: React.FC = () => {
  const { occupancyEntries } = useData();
  const [month, setMonth] = useState(() => currentMonth());

  const activeEntries = occupancyEntries.filter(
    (entry) => entry.date.startsWith(month) && entry.status === 'Activa'
  );
  const canceledEntries = occupancyEntries.filter(
    (entry) => entry.status === 'Cancelada' && entry.canceledAt?.startsWith(month)
  );
  const total = activeEntries.reduce((sum, entry) => sum + entry.price, 0);
  const canceledTotal = canceledEntries.reduce((sum, entry) => sum + entry.price, 0);

  return (
    <div className="admin-page">
      <div className="page-header page-header-row">
        <div>
          <h2>Informe Mensual</h2>
          <p>Resumen de entradas ocupadas y anuladas del mes {month}.</p>
        </div>
        <label className="date-filter-field">
          Mes del informe
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value || currentMonth())}
          />
        </label>
      </div>

      <div className="admin-grid">
        <div className="stat-card report-card">
          <div className="stat-icon">💰</div>
          <div>
            <h3>Total mensual</h3>
            <p className="stat-number">{formatMoney(total)}</p>
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
            <h3>Anuladas</h3>
            <p className="stat-number">{formatMoney(canceledTotal)}</p>
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
                  <td>{formatMoney(entry.price)}</td>
                </tr>
              ))}
              {!activeEntries.length ? (
                <tr><td colSpan={5}>No hay entradas activas para el mes {month}.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card">
        <h3>Entradas anuladas del mes</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Anulada</th>
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
                  <td>{formatMoney(entry.price)}</td>
                  <td>{entry.cancellationReason || '-'}</td>
                </tr>
              ))}
              {!canceledEntries.length ? (
                <tr><td colSpan={5}>No hay entradas anuladas para el mes {month}.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
