import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './AdminLayout.css';

const menuItems = [
  { to: 'dashboard', label: 'Dashboard', icon: '📊' },
  { to: 'habitaciones', label: 'Habitaciones', icon: '🏨' },
  { to: 'usuarios', label: 'Usuarios', icon: '👥' },
  { to: 'reservaciones', label: 'Reservaciones', icon: '📅' },
  { to: 'informe-diario', label: 'Informe Diario', icon: '💵' },
  { to: 'informe-mensual', label: 'Informe Mensual', icon: '📈' },
  { to: 'configuracion', label: 'Configuracion', icon: '⚙️' }
];

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-logo">🏨</div>
          <div>
            <h2>Hotel Admin</h2>
            <p>Panel de control</p>
          </div>
        </div>

        <div className="admin-user-card">
          <span>Usuario</span>
          <strong>{user?.username || 'Invitado'}</strong>
          <small>{user?.email}</small>
        </div>

        <nav className="admin-nav">
          {menuItems.map((item) => (
            <NavLink
              to={item.to}
              key={item.to}
              className={({ isActive }) =>
                isActive ? 'admin-nav-link active' : 'admin-nav-link'
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button className="admin-logout" onClick={handleLogout}>
          Cerrar Sesion
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <h1>Bienvenido al panel administrativo</h1>
        </header>
        <section className="admin-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
};
