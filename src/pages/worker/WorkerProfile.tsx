// Pantalla de perfil del trabajador.
// Permite editar datos personales en estado local y mostrar confirmacion visual.
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

// Componente para editar datos personales en estado local.
export const WorkerProfile: React.FC = () => {
  // Usuario actual usado como valor inicial de nombre y correo.
  const { user } = useAuth();
  // Estados del formulario visible en Mi perfil.
  const [name, setName] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('555-123-456');
  const [note, setNote] = useState('Trabajador responsable de limpieza y orden.');
  const [saved, setSaved] = useState(false);

  // Simula guardado y muestra mensaje temporal de exito.
  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="worker-page">
      <div className="page-header">
        <h2>Mi perfil</h2>
        <p>Actualiza tu información personal y tu descripción de trabajo.</p>
      </div>

      <div className="admin-card profile-card">
        <form onSubmit={handleSave} className="admin-form">
          <label>
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Teléfono
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label>
            Nota personal
            <textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="submit" className="admin-action-btn">
            Guardar cambios
          </button>
          {saved && <p className="saved-message">Perfil actualizado correctamente.</p>}
        </form>
      </div>
    </div>
  );
};
