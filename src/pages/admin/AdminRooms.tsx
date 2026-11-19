// Pantalla de administracion de habitaciones.
// Se ve en /admin/habitaciones y permite crear habitaciones, cambiar estado y anular ocupaciones.
import React, { useState } from 'react';
import { useData } from '../../context/DataContext';

export const AdminRooms: React.FC = () => {
  const { rooms, error, clearError, addRoom, updateRoomStatus, deleteRoom, cancelRoomOccupancy } = useData();

  const [number, setNumber] = useState('');
  const [type, setType] = useState('Doble');
  const [statusNew, setStatusNew] = useState<'Disponible' | 'Mantenimiento'>('Disponible');
  const [cancelingRoomId, setCancelingRoomId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const availableRooms = rooms.filter((r) => r.status === 'Disponible').length;
  const occupiedRooms = rooms.filter((r) => r.status === 'Ocupada').length;
  const maintenanceRooms = rooms.filter((r) => r.status === 'Mantenimiento').length;

  const getStatusClass = (status: 'Disponible' | 'Ocupada' | 'Mantenimiento') => {
    if (status === 'Disponible') return 'status-pill status-disponible';
    if (status === 'Ocupada') return 'status-pill status-ocupada';
    return 'status-pill status-mantenimiento';
  };

  const handleSetMaintenance = async (id: number) => {
    if (submitting) return;
    clearError();
    setLocalError(null);
    setSubmitting(true);
    await updateRoomStatus(id, 'Mantenimiento', 'En mantenimiento');
    setSubmitting(false);
  };

  const handleSetAvailable = async (id: number, wasOccupied: boolean) => {
    if (submitting) return;
    if (wasOccupied && !confirm('¿Finalizar la estancia y pasar a Disponible? El ingreso se conservara en los informes.')) return;
    clearError();
    setLocalError(null);
    setSubmitting(true);
    await updateRoomStatus(id, 'Disponible', wasOccupied ? 'Estancia finalizada' : 'Disponible');
    setSubmitting(false);
  };

  const confirmCancelOccupancy = async () => {
    if (cancelingRoomId === null || submitting) return;
    if (!cancelReason.trim()) {
      setLocalError('Escribe un motivo para anular la entrada.');
      return;
    }
    clearError();
    setLocalError(null);
    setSubmitting(true);
    const saved = await cancelRoomOccupancy(cancelingRoomId, cancelReason.trim());
    setSubmitting(false);
    if (!saved) return;
    setCancelingRoomId(null);
    setCancelReason('');
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    clearError();
    setLocalError(null);

    const roomNumber = number.trim();
    if (!roomNumber || !type) {
      setLocalError('El numero y tipo de habitacion son obligatorios.');
      return;
    }

    if (rooms.some((r) => r.number.toLowerCase() === roomNumber.toLowerCase())) {
      setLocalError('Ya existe una habitacion con ese numero. Elige otro numero.');
      return;
    }

    setSubmitting(true);
    const saved = await addRoom({
      number: roomNumber,
      type,
      status: statusNew,
      note: statusNew === 'Mantenimiento' ? 'En mantenimiento' : undefined
    });
    setSubmitting(false);
    if (!saved) return;
    setNumber('');
    setType('Doble');
    setStatusNew('Disponible');
  };

  const handleDeleteRoom = async (id: number) => {
    if (submitting) return;
    if (!confirm('¿Eliminar habitacion?')) return;
    clearError();
    setLocalError(null);
    setSubmitting(true);
    await deleteRoom(id);
    setSubmitting(false);
  };

  const activeError = localError || error;

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>Habitaciones</h2>
        <p>Revisa disponibilidad, actualiza estados y administra habitaciones en SQL Server. Para ocupar una habitacion con huesped, usa el Dashboard.</p>
      </div>

      {activeError ? <div className="feedback-banner feedback-error">{activeError}</div> : null}

      <div className="admin-grid">
        <div className="admin-card form-section">
          <h3>Agregar nueva habitacion</h3>
          <p>Completa los datos para crear una habitacion en el sistema.</p>
          <form onSubmit={handleAddRoom} className="admin-form form-grid">
            <label>
              Numero
              <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Ej. 101" maxLength={20} />
            </label>
            <label>
              Tipo
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="Individual">Individual</option>
                <option value="Doble">Doble</option>
                <option value="Suite">Suite</option>
              </select>
            </label>
            <label>
              Estado
              <select value={statusNew} onChange={(e) => setStatusNew(e.target.value as 'Disponible' | 'Mantenimiento')}>
                <option value="Disponible">Disponible</option>
                <option value="Mantenimiento">Mantenimiento</option>
              </select>
            </label>
            <button type="submit" disabled={submitting} className="admin-action-btn" style={{ gridColumn: '1 / -1' }}>
              {submitting ? 'Guardando...' : 'Agregar Habitacion'}
            </button>
          </form>
        </div>

        <div className="admin-card summary-card">
          <h3>Resumen de habitaciones</h3>
          <p>Total de habitaciones: <strong>{rooms.length}</strong></p>
          <p>Disponibles: <strong>{availableRooms}</strong></p>
          <p>Ocupadas: <strong>{occupiedRooms}</strong></p>
          <p>En mantenimiento: <strong>{maintenanceRooms}</strong></p>
        </div>
      </div>

      <div className="admin-card room-card">
        <h3>Lista de habitaciones</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Numero</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Nota</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td>{room.number}</td>
                  <td>{room.type}</td>
                  <td>
                    <span className={getStatusClass(room.status)}>{room.status}</span>
                  </td>
                  <td>{room.note || '-'}</td>
                  <td className="table-actions">
                    {room.status === 'Ocupada' ? (
                      <>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleSetAvailable(room.id, true)}
                          className="table-btn btn-success"
                        >
                          Finalizar
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => {
                            setCancelingRoomId(room.id);
                            setCancelReason('');
                            setLocalError(null);
                          }}
                          className="table-btn btn-danger"
                        >
                          Anular
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={submitting || room.status === 'Disponible'}
                        onClick={() => handleSetAvailable(room.id, false)}
                        className="table-btn"
                      >
                        Disponible
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={submitting || room.status === 'Mantenimiento'}
                      onClick={() => handleSetMaintenance(room.id)}
                      className="table-btn btn-warning"
                    >
                      Mant.
                    </button>
                    <button
                      type="button"
                      disabled={submitting || room.status === 'Ocupada'}
                      onClick={() => handleDeleteRoom(room.id)}
                      className="table-btn btn-danger"
                      title={room.status === 'Ocupada' ? 'Libera la habitacion antes de eliminarla' : 'Eliminar habitacion'}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!rooms.length ? (
                <tr><td colSpan={5}>No hay habitaciones registradas.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {cancelingRoomId !== null ? (
        <div className="dashboard-modal-overlay" onClick={() => setCancelingRoomId(null)}>
          <div className="dashboard-modal reservation-alert-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Anular entrada</h3>
              <button type="button" className="modal-close" onClick={() => setCancelingRoomId(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Escribe el motivo para volver la habitacion a Disponible y pasar el valor a entradas canceladas.</p>
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Motivo obligatorio"
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', minHeight: 90 }}
              />
              <button type="button" disabled={submitting} className="admin-action-btn" onClick={confirmCancelOccupancy}>
                {submitting ? 'Guardando...' : 'Confirmar anulacion'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
