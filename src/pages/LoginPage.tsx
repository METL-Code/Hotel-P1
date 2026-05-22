// Pantalla de inicio de sesion.
// Se ve en / y permite escoger rol, escribir credenciales y entrar al panel correcto.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

// Componente que pinta el login completo.
export const LoginPage: React.FC = () => {
  // Rol elegido; controla si se ve seleccion de rol o formulario.
  const [selectedRole, setSelectedRole] = useState<'admin' | 'trabajador' | null>(null);
  // Campos y estados visibles del formulario de login.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Funcion login viene de AuthContext y decide API/local.
  const { login } = useAuth();
  const navigate = useNavigate();

  // Al elegir rol, limpia formulario y muestra campos de usuario/clave.
  const handleRoleSelect = (role: 'admin' | 'trabajador') => {
    setSelectedRole(role);
    setError('');
    setUsername('');
    setPassword('');
  };

  // Redirige al dashboard correcto segun rol autenticado.
  const goToPanel = (role: 'admin' | 'trabajador') => {
    navigate(role === 'admin' ? '/admin/dashboard' : '/trabajador/dashboard');
  };

  // Envia credenciales, muestra loading y errores si falla.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!selectedRole) {
        throw new Error('Selecciona un rol');
      }

      await login(username, password, selectedRole);
      goToPanel(selectedRole);
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

        {/* Si no hay rol seleccionado, se muestran los dos botones de acceso. */}
        {!selectedRole ? (
          <div className="role-selection">
            <h2>Selecciona tu rol de acceso</h2>
            <div className="role-buttons">
              <button
                className="role-btn admin-btn"
                onClick={() => handleRoleSelect('admin')}
              >
                <span className="role-icon">👨‍💼</span>
                <span className="role-name">Administrador</span>
                <span className="role-description">Acceso completo al sistema</span>
              </button>
              <button
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
          /* Si ya hay rol, se muestra el formulario de usuario y contrasena. */
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
                placeholder={selectedRole === 'admin' ? 'admin123' : 'trabajador123'}
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
