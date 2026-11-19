// Pantalla de administracion de usuarios.
// Se ve en /admin/usuarios y lee/guarda todos los cambios directamente en dbo.Usuarios de SQL Server.
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { AdminUser } from '../../context/DataContext';
import { apiGet, apiSend } from '../../services/api';
import { getErrorMessage } from '../../utils/format';

interface UsersResponse {
  users: AdminUser[];
}

interface UserResponse {
  user: AdminUser;
}

export const AdminUsers: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [visibleUsers, setVisibleUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'trabajador'>('trabajador');

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiGet<UsersResponse>('/api/users')
      .then((data) => {
        if (!active) return;
        setVisibleUsers(data.users);
      })
      .catch((error) => {
        if (!active) return;
        setFeedback({ type: 'error', message: `No se pudieron cargar los usuarios: ${getErrorMessage(error)}` });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const resetForm = () => {
    setEditingUserId(null);
    setNombres('');
    setApellidos('');
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('trabajador');
  };

  const validateUserFields = () => {
    const nextUser = username.trim();
    const nextEmail = email.trim();

    if (!nombres.trim() || !apellidos.trim() || !nextUser || !nextEmail) {
      setFeedback({ type: 'error', message: 'Nombres, apellidos, usuario y email son obligatorios.' });
      return null;
    }

    const duplicatedUsername = visibleUsers.some((user) =>
      user.id !== editingUserId &&
      user.username.toLowerCase() === nextUser.toLowerCase()
    );
    if (duplicatedUsername) {
      setFeedback({ type: 'error', message: 'Ya existe un usuario con ese nombre de usuario.' });
      return null;
    }

    const duplicatedEmail = visibleUsers.some((user) =>
      user.id !== editingUserId &&
      user.email.toLowerCase() === nextEmail.toLowerCase()
    );
    if (duplicatedEmail) {
      setFeedback({ type: 'error', message: 'Ya existe un usuario con ese email.' });
      return null;
    }

    return {
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      username: nextUser,
      email: nextEmail,
      role
    };
  };

  const handleSubmitUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setFeedback(null);

    const userFields = validateUserFields();
    if (!userFields) return;

    const rawPassword = password;
    if (editingUserId !== null) {
      if (rawPassword && rawPassword.length < 6) {
        setFeedback({ type: 'error', message: 'La nueva clave debe tener al menos 6 caracteres.' });
        return;
      }
      setSubmitting(true);
      try {
        const updatePayload = rawPassword ? { ...userFields, password: rawPassword } : userFields;
        const data = await apiSend<UserResponse>(`/api/users/${editingUserId}`, 'PUT', updatePayload);
        setVisibleUsers((prev) => prev.map((item) => item.id === editingUserId ? data.user : item));
        resetForm();
        setFeedback({ type: 'success', message: 'Usuario actualizado en SQL Server.' });
      } catch (error) {
        setFeedback({ type: 'error', message: `No se pudo actualizar: ${getErrorMessage(error)}` });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (rawPassword.length < 6) {
      setFeedback({ type: 'error', message: 'La clave es obligatoria y debe tener al menos 6 caracteres.' });
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiSend<UserResponse>('/api/users', 'POST', {
        ...userFields,
        password: rawPassword
      });
      setVisibleUsers((prev) => [...prev, data.user]);
      resetForm();
      setFeedback({ type: 'success', message: 'Usuario creado en SQL Server.' });
    } catch (error) {
      setFeedback({ type: 'error', message: `No se pudo crear: ${getErrorMessage(error)}` });
    } finally {
      setSubmitting(false);
    }
  };

  const beginEditUser = (id: number) => {
    const user = visibleUsers.find((item) => item.id === id);
    if (!user) return;
    setFeedback(null);
    setEditingUserId(user.id);
    setNombres(user.nombres);
    setApellidos(user.apellidos);
    setUsername(user.username);
    setEmail(user.email);
    setPassword('');
    setRole(user.role);
  };

  const handleDeleteUser = async (id: number) => {
    if (submitting) return;
    if (!confirm('¿Eliminar usuario? Esta accion no se puede deshacer.')) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      await apiSend(`/api/users/${id}`, 'DELETE');
      if (editingUserId === id) resetForm();
      setVisibleUsers((prev) => prev.filter((item) => item.id !== id));
      setFeedback({ type: 'success', message: 'Usuario eliminado correctamente.' });
    } catch (error) {
      setFeedback({ type: 'error', message: `No se pudo eliminar: ${getErrorMessage(error)}` });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id: number) => {
    if (submitting) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      const data = await apiSend<UserResponse>(`/api/users/${id}`, 'PATCH');
      setVisibleUsers((prev) => prev.map((item) => item.id === id ? data.user : item));
    } catch (error) {
      setFeedback({ type: 'error', message: `No se pudo cambiar estado: ${getErrorMessage(error)}` });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>Usuarios</h2>
        <p>Gestiona las cuentas de acceso guardadas en SQL Server.</p>
      </div>

      {feedback ? (
        <div className={`feedback-banner ${feedback.type === 'error' ? 'feedback-error' : 'feedback-success'}`}>
          {feedback.message}
        </div>
      ) : null}

      <div className="admin-grid">
        <div className="admin-card user-card">
          <h3>{editingUserId !== null ? 'Editar usuario' : 'Crear nuevo usuario'}</h3>
          <form onSubmit={handleSubmitUser} className="admin-form">
            <label>
              Nombres
              <input value={nombres} onChange={(e) => setNombres(e.target.value)} placeholder="Nombres" maxLength={100} />
            </label>

            <label>
              Apellidos
              <input value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="Apellidos" maxLength={100} />
            </label>

            <label>
              Usuario
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nombre de usuario" maxLength={100} />
            </label>

            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@hotel.com" maxLength={150} />
            </label>

            <label>
              Clave
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                placeholder={editingUserId !== null ? 'Dejar en blanco para conservar la actual' : 'Minimo 6 caracteres'}
              />
            </label>

            <label>
              Rol
              <select
                value={role}
                disabled={String(editingUserId) === currentUser?.id}
                onChange={(e) => setRole(e.target.value as 'admin' | 'trabajador')}
              >
                <option value="trabajador">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </label>

            <button type="submit" disabled={submitting} className="admin-action-btn">
              {submitting ? 'Guardando...' : editingUserId !== null ? 'Guardar cambios' : 'Agregar Usuario'}
            </button>
            {editingUserId !== null ? (
              <button type="button" className="table-btn" onClick={resetForm}>
                Cancelar edicion
              </button>
            ) : null}
          </form>
        </div>

        <div className="admin-card user-table-card">
          <h3>Lista de usuarios ({visibleUsers.length})</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => {
                  const isSelf = String(user.id) === currentUser?.id;
                  return (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.nombres} {user.apellidos}</td>
                      <td>
                        {user.username} {isSelf ? <span className="status-pill status-confirmada">Tu</span> : null}
                      </td>
                      <td>{user.email}</td>
                      <td>{user.role === 'admin' ? 'Administrador' : 'Usuario'}</td>
                      <td>
                        <span className={`status-pill ${user.status === 'Activo' ? 'status-disponible' : 'status-cancelada'}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="table-actions">
                        <button type="button" disabled={submitting} onClick={() => beginEditUser(user.id)} className="table-btn">
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={submitting || isSelf}
                          onClick={() => toggleStatus(user.id)}
                          className="table-btn"
                        >
                          {user.status === 'Activo' ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          disabled={submitting || isSelf}
                          onClick={() => handleDeleteUser(user.id)}
                          className="table-btn btn-danger"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!loading && !visibleUsers.length ? (
                  <tr><td colSpan={7}>No hay usuarios registrados.</td></tr>
                ) : null}
                {loading && !visibleUsers.length ? (
                  <tr><td colSpan={7}>Cargando usuarios...</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
