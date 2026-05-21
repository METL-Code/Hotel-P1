import React from 'react';

export const AdminReports: React.FC = () => {
  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>Reportes</h2>
        <p>Revisa datos generales del hotel y el rendimiento operativo.</p>
      </div>

      <div className="admin-grid">
        <div className="stat-card report-card">
          <div className="stat-icon">💼</div>
          <div>
            <h3>Ingresos acumulados</h3>
            <p className="stat-number">$118,400</p>
          </div>
        </div>

        <div className="stat-card report-card">
          <div className="stat-icon">🛌</div>
          <div>
            <h3>Ocupación</h3>
            <p className="stat-number">78%</p>
          </div>
        </div>

        <div className="stat-card report-card">
          <div className="stat-icon">📈</div>
          <div>
            <h3>Crecimiento mensual</h3>
            <p className="stat-number">+12%</p>
          </div>
        </div>

        <div className="stat-card report-card">
          <div className="stat-icon">⭐</div>
          <div>
            <h3>Valoración promedio</h3>
            <p className="stat-number">4.7 / 5</p>
          </div>
        </div>
      </div>

      <div className="admin-card report-insights">
        <h3>Observaciones clave</h3>
        <ul>
          <li>La ocupación ha mejorado un 14% en comparación con el mes anterior.</li>
          <li>Las habitaciones de categoría Suite son las más reservadas.</li>
          <li>El inventario de suministros se debe revisar en 5 días.</li>
          <li>El equipo de trabajadores tiene un 92% de cumplir con sus tareas.</li>
        </ul>
      </div>
    </div>
  );
};
