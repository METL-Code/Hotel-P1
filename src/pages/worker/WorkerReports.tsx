import React from 'react';

export const WorkerReports: React.FC = () => {
  return (
    <div className="worker-page">
      <div className="page-header">
        <h2>Reportes</h2>
        <p>Visualiza tu rendimiento y entregas recientes.</p>
      </div>

      <div className="admin-grid report-grid">
        <div className="stat-card report-card">
          <div className="stat-icon">✅</div>
          <div>
            <h3>Tareas completadas</h3>
            <p className="stat-number">24</p>
          </div>
        </div>

        <div className="stat-card report-card">
          <div className="stat-icon">⏱️</div>
          <div>
            <h3>Horas trabajadas</h3>
            <p className="stat-number">42h</p>
          </div>
        </div>

        <div className="stat-card report-card">
          <div className="stat-icon">⭐</div>
          <div>
            <h3>Feedback positivo</h3>
            <p className="stat-number">87%</p>
          </div>
        </div>

        <div className="stat-card report-card">
          <div className="stat-icon">📅</div>
          <div>
            <h3>Días trabajados</h3>
            <p className="stat-number">18</p>
          </div>
        </div>
      </div>
    </div>
  );
};
