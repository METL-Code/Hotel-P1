// Pantalla de reportes generales.
// Calcula todos sus indicadores en tiempo real a partir de los datos de SQL Server cargados en DataContext.
import React from 'react';
import { useData } from '../../context/DataContext';
import { formatMoney } from '../../utils/format';

export const AdminReports: React.FC = () => {
  const { rooms, reservations, guests, occupancyEntries } = useData();

  const activeEntries = occupancyEntries.filter((entry) => entry.status === 'Activa');
  const canceledEntries = occupancyEntries.filter((entry) => entry.status === 'Cancelada');
  const totalRevenue = activeEntries.reduce((sum, entry) => sum + entry.price, 0);
  const occupiedCount = rooms.filter((room) => room.status === 'Ocupada').length;
  const availableCount = rooms.filter((room) => room.status === 'Disponible').length;
  const maintenanceCount = rooms.filter((room) => room.status === 'Mantenimiento').length;
  const occupancyRate = rooms.length ? Math.round((occupiedCount / rooms.length) * 100) : 0;

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>Reportes</h2>
        <p>Indicadores reales calculados desde la base de datos SQL Server.</p>
      </div>

      <div className="admin-grid">
        <div className="stat-card report-card">
          <div className="stat-icon">💼</div>
          <div>
            <h3>Ingresos acumulados</h3>
            <p className="stat-number">{formatMoney(totalRevenue)}</p>
          </div>
        </div>

        <div className="stat-card report-card">
          <div className="stat-icon">🛌</div>
          <div>
            <h3>Ocupacion actual</h3>
            <p className="stat-number">{occupancyRate}% ({occupiedCount}/{rooms.length})</p>
          </div>
        </div>

        <div className="stat-card report-card">
          <div className="stat-icon">📅</div>
          <div>
            <h3>Reservaciones activas</h3>
            <p className="stat-number">{reservations.length}</p>
          </div>
        </div>

        <div className="stat-card report-card">
          <div className="stat-icon">🧾</div>
          <div>
            <h3>Huespedes registrados</h3>
            <p className="stat-number">{guests.length}</p>
          </div>
        </div>
      </div>

      <div className="admin-card report-insights">
        <h3>Resumen de la base de datos</h3>
        <ul>
          <li>Habitaciones en SQL Server: {rooms.length} ({availableCount} disponibles, {occupiedCount} ocupadas, {maintenanceCount} en mantenimiento).</li>
          <li>Entradas de ocupacion registradas: {activeEntries.length} activas y {canceledEntries.length} anuladas.</li>
          <li>Reservaciones vigentes en lista: {reservations.length}.</li>
          <li>Huespedes guardados por cedula: {guests.length}.</li>
        </ul>
      </div>
    </div>
  );
};
