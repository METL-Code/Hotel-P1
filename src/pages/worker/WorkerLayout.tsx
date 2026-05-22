// Layout principal del panel trabajador.
// Se ve en rutas /trabajador/* y contiene sidebar, datos del usuario y Outlet para la pantalla hija.
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './WorkerLayout.css';

// Menu disponible para trabajador.
const menuItems = [
  { to: 'dashboard', label: 'Dashboard', icon: '📊' },
  { to: 'reservaciones', label: 'Reservaciones', icon: '📅' },
  { to: 'configuracion', label: 'Configuracion', icon: '⚙️' }
];

// Componente que pinta la estructura fija del panel trabajador.
export const WorkerLayout: React.FC = () => {
  // Usuario actual y funcion para cerrar sesion.
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Cierra sesion y regresa al login.
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

        <button className="worker-logout" onClick={handleLogout}>
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
