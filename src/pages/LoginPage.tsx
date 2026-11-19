// Pantalla de inicio de sesion.
// Se ve en / y permite escoger rol, escribir credenciales y entrar al panel correcto.
import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<'admin' | 'trabajador' | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Si ya hay sesion activa, redirige automaticamente al panel correspondiente.
  if (isAuthenticated && user) {
    return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/trabajador/dashboard'} replace />;
  }

  const handleRoleSelect = (role: 'admin' | 'trabajador') => {
    setSelectedRole(role);
    setError('');
    setUsername('');
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!selectedRole) {
        throw new Error('Selecciona un rol');
      }

      await login(username, password, selectedRole);
      navigate(selectedRole === 'admin' ? '/admin/dashboard' : '/trabajador/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="hotel-title">Hotel Management</h1>

        {!selectedRole ? (
          <div className="role-selection">
            <h2>Selecciona tu rol de acceso</h2>
            <div className="role-buttons">
              <button
                type="button"
                className="role-btn admin-btn"
                onClick={() => handleRoleSelect('admin')}
              >
                <span className="role-icon">👨‍💼</span>
                <span className="role-name">Administrador</span>
                <span className="role-description">Acceso completo al sistema</span>
              </button>
              <button
                type="button"
                className="role-btn worker-btn"
                onClick={() => handleRoleSelect('trabajador')}
              >
                <span className="role-icon">👤</span>
                <span className="role-name">Usuario</span>
                <span className="role-description">Acceso al modulo de usuario</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="role-badge">
              <button
                type="button"
                className="back-btn"
                onClick={() => setSelectedRole(null)}
              >
                Volver
              </button>
              <span className={`badge ${selectedRole}`}>
                {selectedRole === 'admin' ? 'Administrador' : 'Usuario'}
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="username">Usuario</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder={selectedRole === 'admin' ? 'Usuario administrador' : 'Tu usuario'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contrasena</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Ingresa tu contrasena"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className={`login-btn ${selectedRole}`}
            >
              {loading ? 'Iniciando sesion...' : 'Iniciar Sesion'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
