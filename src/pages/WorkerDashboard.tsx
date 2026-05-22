// Dashboard especifico del trabajador.
// Esta pantalla existe para /trabajador/dashboard, aunque App.tsx actualmente usa AdminDashboard en esa ruta.
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import './WorkerDashboard.css';

// Devuelve el mes actual en formato YYYY-MM para filtrar entradas.
const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

// Formatea valores como pesos colombianos.
const money = (value: number) => value.toLocaleString('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

// Componente de dashboard del trabajador con tarjetas y accesos rapidos.
export const WorkerDashboard: React.FC = () => {
  // Usuario logueado mostrado en el saludo.
  const { user } = useAuth();
  // Datos usados para indicadores de tareas e ingresos.
  const { reservations, occupancyEntries } = useData();

  // Calculos visibles en tarjetas del mes actual.
  const month = currentMonth();
  const activeMonthlyEntries = occupancyEntries.filter((entry) => entry.date.startsWith(month) && entry.status === 'Activa');
  // Calculos visibles en tarjetas del mes actual.
  const monthlyTotal = activeMonthlyEntries.reduce((sum, entry) => sum + entry.price, 0);
  const canceledMonthlyEntries = occupancyEntries.filter((entry) => entry.canceledAt?.startsWith(month));

  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <div>
          <h2>Bienvenido, {user?.username}!</h2>
          <p>Revisa tus indicadores y accede rapido a tu trabajo diario.</p>
        </div>
        <div className="dashboard-badge worker-badge">Trabajador</div>
      </div>

      {/* Tarjetas de indicadores del trabajador. */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🧹</div>
          <div className="stat-content">
            <h3>Tareas Asignadas</h3>
            <p className="stat-number">{reservations.length}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>Tareas Completadas</h3>
            <p className="stat-number">0</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Total Mensual</h3>
            <p className="stat-number">{money(monthlyTotal)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">❌</div>
          <div className="stat-content">
            <h3>Canceladas del Mes</h3>
            <p className="stat-number">{canceledMonthlyEntries.length}</p>
          </div>
        </div>
      </div>

      {/* Accesos rapidos hacia secciones del trabajador. */}
      <div className="admin-actions">
        <h3>Acciones rapidas</h3>
        <div className="actions-grid">
          <Link to="/trabajador/tareas" className="action-btn">
            <span className="action-icon">🧹</span>
            <span>Mis tareas</span>
          </Link>
          <Link to="/trabajador/reportes" className="action-btn">
            <span className="action-icon">📝</span>
            <span>Reportes</span>
          </Link>
          <Link to="/trabajador/informe-mensual" className="action-btn">
            <span className="action-icon">📈</span>
            <span>Informe Mensual</span>
          </Link>
          <Link to="/trabajador/mensajes" className="action-btn">
            <span className="action-icon">💬</span>
            <span>Mensajes</span>
          </Link>
          <Link to="/trabajador/perfil" className="action-btn">
            <span className="action-icon">👤</span>
            <span>Mi perfil</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
