import React, { useState } from 'react';
import { useData } from '../../context/DataContext';

export const AdminRooms: React.FC = () => {
  const { rooms, addRoom, updateRoomStatus, deleteRoom, cancelRoomOccupancy } = useData();

  const [number, setNumber] = useState('');
  const [type, setType] = useState('Doble');
  const [statusNew, setStatusNew] = useState<'Disponible' | 'Mantenimiento'>('Disponible');
  const [cancelingRoomId, setCancelingRoomId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const availableRooms = rooms.filter((r) => r.status === 'Disponible').length;
  const occupiedRooms = rooms.filter((r) => r.status === 'Ocupada').length;
  const maintenanceRooms = rooms.filter((r) => r.status === 'Mantenimiento').length;

  const getStatusClass = (status: 'Disponible' | 'Ocupada' | 'Mantenimiento') => {
    if (status === 'Disponible') return 'status-pill status-disponible';
    if (status === 'Ocupada') return 'status-pill status-ocupada';
    return 'status-pill status-mantenimiento';
  };

  const updateStatus = (id: number, nextStatus: 'Disponible' | 'Ocupada' | 'Mantenimiento') => {
    if (nextStatus === 'Ocupada') {
      alert('Para ocupar una habitacion, usa el dashboard y registra huesped y valor acordado.');
      return;
    }
    updateRoomStatus(id, nextStatus);
  };

  const confirmCancelOccupancy = () => {
    if (cancelingRoomId === null) return;
    if (!cancelReason.trim()) {
      alert('Escribe un motivo.');
      return;
    }
    cancelRoomOccupancy(cancelingRoomId, cancelReason.trim());
    setCancelingRoomId(null);
    setCancelReason('');
  };

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const roomNumber = number.trim();
    if (!roomNumber || !type) return;

    if (rooms.some((r) => r.number === roomNumber)) {
      alert('Ya existe una habitacion con ese numero. Elige otro numero.');
      return;
    }

    addRoom({ number: roomNumber, type, status: statusNew });
    setNumber('');
    setType('Doble');
    setStatusNew('Disponible');
  };

  const handleDeleteRoom = (id: number) => {
    if (!confirm('Eliminar habitacion?')) return;
    deleteRoom(id);
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>Habitaciones</h2>
        <p>Revisa disponibilidad, actualiza estados y administra habitaciones.</p>
      </div>

      <div className="admin-grid">
        <div className="admin-card form-section">
          <h3>Agregar nueva habitacion</h3>
          <p>Completa los datos para crear una habitacion en el sistema.</p>
          <form onSubmit={handleAddRoom} className="admin-form form-grid">
            <label>
              Numero
              <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="101" />
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
            <button type="submit" className="admin-action-btn" style={{ gridColumn: '1 / -1' }}>
              Agregar Habitacion
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
                  <td className="table-actions">
                    {room.status === 'Ocupada' ? (
                      <button onClick={() => { setCancelingRoomId(room.id); setCancelReason(''); }} className="table-btn" style={{ background: '#ef4444', color: 'white' }}>
                        Cancelar
                      </button>
                    ) : (
                      <button onClick={() => updateStatus(room.id, 'Disponible')} className="table-btn">
                        Disponible
                      </button>
                    )}
                    <button onClick={() => updateStatus(room.id, 'Ocupada')} className="table-btn">
                      Ocupada
                    </button>
                    <button onClick={() => updateStatus(room.id, 'Mantenimiento')} className="table-btn">
                      Mant.
                    </button>
                    <button onClick={() => handleDeleteRoom(room.id)} className="table-btn" style={{ marginLeft: 8, background: '#ef4444', color: 'white' }}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {cancelingRoomId !== null ? (
        <div className="dashboard-modal-overlay" onClick={() => setCancelingRoomId(null)}>
          <div className="dashboard-modal reservation-alert-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Cancelar entrada</h3>
              <button className="modal-close" onClick={() => setCancelingRoomId(null)}>x</button>
            </div>
            <div className="modal-body">
              <p>Escribe el motivo para volver la habitacion a Disponible y mover el valor a entradas canceladas.</p>
              <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Motivo obligatorio" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <button className="admin-action-btn" onClick={confirmCancelOccupancy}>Confirmar cancelacion</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
