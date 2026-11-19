// Informe diario administrativo.
// Se ve en /admin/informe-diario y permite consultar cualquier fecha desde SQL Server.
import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { formatMoney, todayDate } from '../../utils/format';

export const AdminDailyReport: React.FC = () => {
  const { occupancyEntries } = useData();
  const [reportDate, setReportDate] = useState(() => todayDate());

  const activeEntries = occupancyEntries.filter(
    (entry) => entry.date === reportDate && entry.status === 'Activa'
  );
  const canceledEntries = occupancyEntries.filter(
    (entry) => entry.status === 'Cancelada' && entry.canceledAt === reportDate
  );
  const total = activeEntries.reduce((sum, entry) => sum + entry.price, 0);
  const canceledTotal = canceledEntries.reduce((sum, entry) => sum + entry.price, 0);

  return (
    <div className="admin-page">
      <div className="page-header page-header-row">
        <div>
          <h2>Informe Diario</h2>
          <p>Entradas ocupadas y anuladas del dia {reportDate}.</p>
        </div>
        <label className="date-filter-field">
          Fecha del informe
          <input
            type="date"
            value={reportDate}
            onChange={(event) => setReportDate(event.target.value || todayDate())}
          />
        </label>
      </div>

      <div className="admin-grid">
        <div className="stat-card report-card">
          <div className="stat-icon">💰</div>
          <div>
            <h3>Total del dia</h3>
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
            <h3>Entradas anuladas</h3>
            <p className="stat-number">{formatMoney(canceledTotal)}</p>
          </div>
        </div>
      </div>

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
                  <td>{formatMoney(entry.price)}</td>
                </tr>
              ))}
              {!activeEntries.length ? (
                <tr><td colSpan={4}>No hay entradas activas para el {reportDate}.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card">
        <h3>Entradas anuladas</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha entrada</th>
                <th>Habitacion</th>
                <th>Huesped</th>
                <th>Valor eliminado</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {canceledEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.date}</td>
                  <td>{entry.roomNumber}</td>
                  <td>{entry.guestName}</td>
                  <td>{formatMoney(entry.price)}</td>
                  <td>{entry.cancellationReason || '-'}</td>
                </tr>
              ))}
              {!canceledEntries.length ? (
                <tr><td colSpan={5}>No hay entradas anuladas para el {reportDate}.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
