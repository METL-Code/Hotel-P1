// Layout principal del panel trabajador.
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './WorkerLayout.css';

const menuItems = [
  { to: 'dashboard', label: 'Dashboard', icon: '📊' },
  { to: 'reservaciones', label: 'Reservaciones', icon: '📅' },
  { to: 'configuracion', label: 'Configuracion', icon: '⚙️' }
];

export const WorkerLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="worker-shell">
      <aside className="worker-sidebar">
        <div className="worker-brand">
          <div className="worker-logo">🏨</div>
          <div>
            <h2>Hotel Worker</h2>
            <p>Panel de control</p>
          </div>
        </div>

        <div className="worker-user-card">
          <span>Usuario</span>
          <strong>{user?.username || 'Invitado'}</strong>
          <small>{user?.email}</small>
        </div>

        <nav className="worker-nav">
          {menuItems.map((item) => (
            <NavLink
              to={item.to}
              key={item.to}
              className={({ isActive }) =>
                isActive ? 'worker-nav-link active' : 'worker-nav-link'
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button type="button" className="worker-logout" onClick={handleLogout}>
          Cerrar Sesion
        </button>
      </aside>

      <main className="worker-main">
        <header className="worker-topbar">
          <h1>Panel de control</h1>
        </header>

        <section className="worker-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
};
