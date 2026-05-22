// Pantalla de administracion de usuarios.
// Se ve en /admin/usuarios y permite crear, editar, activar, desactivar y eliminar usuarios.
import React, { useEffect, useState } from 'react';
import type { AdminUser } from '../../context/DataContext';
import { useData } from '../../context/DataContext';
import { apiGet, apiSend, isApiEnabled } from '../../services/api';

// Tipos de respuesta esperados desde backend/server.js.
interface UsersResponse {
  users: AdminUser[];
}

interface UserResponse {
  user: AdminUser;
}

// Componente de CRUD de usuarios: formulario a la izquierda y tabla a la derecha.
export const AdminUsers: React.FC = () => {
  // Datos locales y acciones de DataContext para modo sin API.
  const { users, addUser, updateUser, toggleUserStatus, deleteUser } = useData();
  // Lista que se muestra en pantalla; viene de API si esta activa o localStorage si no.
  const [visibleUsers, setVisibleUsers] = useState<AdminUser[]>(users);
  const [backendEnabled, setBackendEnabled] = useState(false);
  // Estados del formulario de crear/editar usuario.
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'trabajador'>('trabajador');

  // Carga usuarios desde API si esta activada; si no, usa los datos locales.
  useEffect(() => {
    if (!isApiEnabled()) {
      setVisibleUsers(users);
      setBackendEnabled(false);
      return;
    }

    let active = true;

    apiGet<UsersResponse>('/api/users')
      .then((data) => {
        if (!active) return;
        setVisibleUsers(data.users);
        setBackendEnabled(true);
      })
      .catch(() => {
        if (!active) return;
        setVisibleUsers(users);
        setBackendEnabled(false);
      });

    return () => {
      active = false;
    };
  }, [users]);

  // Limpia el formulario despues de guardar o cancelar edicion.
  const resetForm = () => {
    setEditingUserId(null);
    setNombres('');
    setApellidos('');
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('trabajador');
  };

  // Valida campos obligatorios y evita usuarios/email duplicados.
  const validateUserFields = () => {
    const nextUser = username.trim();
    const nextEmail = email.trim();

    if (!nombres.trim() || !apellidos.trim() || !nextUser || !nextEmail) {
      alert('Nombres, apellidos, usuario y email son obligatorios.');
      return null;
    }

    const duplicatedUsername = visibleUsers.some((user) =>
      user.id !== editingUserId &&
      user.username.toLowerCase() === nextUser.toLowerCase()
    );
    if (duplicatedUsername) {
      alert('Ya existe un usuario con ese nombre de usuario.');
      return null;
    }

    const duplicatedEmail = visibleUsers.some((user) =>
      user.id !== editingUserId &&
      user.email.toLowerCase() === nextEmail.toLowerCase()
    );
    if (duplicatedEmail) {
      alert('Ya existe un usuario con ese email.');
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

  // Decide si crear un usuario nuevo o actualizar uno existente.
  const handleSubmitUser = async (event: React.FormEvent) => {
    event.preventDefault();
    const userFields = validateUserFields();
    if (!userFields) return;

    if (editingUserId !== null) {
      if (backendEnabled) {
        const data = await apiSend<UserResponse>(`/api/users/${editingUserId}`, 'PUT', userFields);
        setVisibleUsers((prev) => prev.map((item) => item.id === editingUserId ? data.user : item));
      } else {
        updateUser(editingUserId, userFields);
      }
      resetForm();
      return;
    }

    if (!password.trim()) {
      alert('La clave es obligatoria al crear un usuario.');
      return;
    }

    const payload = {
      ...userFields,
      password: password.trim()
    };

    if (backendEnabled) {
      const data = await apiSend<UserResponse>('/api/users', 'POST', payload);
      setVisibleUsers((prev) => [...prev, data.user]);
    } else {
      addUser(payload);
    }
    resetForm();
  };

  // Carga los datos de un usuario en el formulario para editarlo.
  const beginEditUser = (id: number) => {
    const user = visibleUsers.find((item) => item.id === id);
    if (!user) return;

    setEditingUserId(user.id);
    setNombres(user.nombres);
    setApellidos(user.apellidos);
    setUsername(user.username);
    setEmail(user.email);
    setPassword('');
    setRole(user.role);
  };

  // Elimina un usuario despues de confirmar la accion.
  const handleDeleteUser = async (id: number) => {
    if (!confirm('Eliminar usuario? Esta accion no se puede deshacer.')) return;
    if (editingUserId === id) {
      resetForm();
    }
    if (backendEnabled) {
      await apiSend(`/api/users/${id}`, 'DELETE');
      setVisibleUsers((prev) => prev.filter((item) => item.id !== id));
    } else {
      deleteUser(id);
    }
  };

  // Cambia el estado visible Activo/Inactivo de un usuario.
  const toggleStatus = async (id: number) => {
    if (backendEnabled) {
      const data = await apiSend<UserResponse>(`/api/users/${id}`, 'PATCH');
      setVisibleUsers((prev) => prev.map((item) => item.id === id ? data.user : item));
    } else {
      toggleUserStatus(id);
    }
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>Usuarios</h2>
        <p>Gestiona las cuentas de acceso al sistema.</p>
      </div>

      <div className="admin-grid">
        <div className="admin-card user-card">
          <h3>{editingUserId !== null ? 'Editar usuario' : 'Crear nuevo usuario'}</h3>
          <form onSubmit={handleSubmitUser} className="admin-form">
            <label>
              Nombres
              <input
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                placeholder="Nombres"
              />
            </label>

            <label>
              Apellidos
              <input
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                placeholder="Apellidos"
              />
            </label>

            <label>
              Usuario
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nombre de usuario"
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@hotel.com"
              />
            </label>

            <label>
              Clave
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editingUserId !== null ? 'La clave no se puede editar' : 'Clave de acceso'}
                disabled={editingUserId !== null}
              />
            </label>

            <label>
              Rol
              <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'trabajador')}>
                <option value="trabajador">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </label>

            <button type="submit" className="admin-action-btn">
              {editingUserId !== null ? 'Guardar cambios' : 'Agregar Usuario'}
            </button>
            {editingUserId !== null ? (
              <button type="button" className="table-btn" onClick={resetForm}>
                Cancelar edicion
              </button>
            ) : null}
          </form>
        </div>

        <div className="admin-card user-table-card">
          <h3>Lista de usuarios</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Clave</th>
                  <th>Estado</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.nombres} {user.apellidos}</td>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>{user.role === 'admin' ? 'Administrador' : 'Usuario'}</td>
                    <td>{'*'.repeat(Math.min(user.password.length, 10))}</td>
                    <td>{user.status}</td>
                    <td>
                      <button onClick={() => beginEditUser(user.id)} className="table-btn">
                        Editar
                      </button>
                      <button onClick={() => toggleStatus(user.id)} className="table-btn" style={{ marginLeft: 8 }}>
                        {user.status === 'Activo' ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => handleDeleteUser(user.id)} className="table-btn" style={{ marginLeft: 8, background: '#ef4444', color: 'white' }}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
