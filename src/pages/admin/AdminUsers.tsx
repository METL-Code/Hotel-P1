import React, { useEffect, useState } from 'react';
import type { AdminUser } from '../../context/DataContext';
import { useData } from '../../context/DataContext';
import { apiGet, apiSend } from '../../services/api';

interface UsersResponse {
  users: AdminUser[];
}

interface UserResponse {
  user: AdminUser;
}

export const AdminUsers: React.FC = () => {
  const { users, addUser, updateUser, toggleUserStatus, deleteUser } = useData();
  const [visibleUsers, setVisibleUsers] = useState<AdminUser[]>(users);
  const [backendEnabled, setBackendEnabled] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'trabajador'>('trabajador');

  useEffect(() => {
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
