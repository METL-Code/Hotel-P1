import React from 'react';

const assignedRooms = [
  { id: 1, room: '105', type: 'Doble', status: 'Limpieza pendiente' },
  { id: 2, room: '207', type: 'Suite', status: 'Verificar minibar' },
  { id: 3, room: '302', type: 'Individual', status: 'Listo para check-in' }
];

export const WorkerRooms: React.FC = () => {
  return (
    <div className="worker-page">
      <div className="page-header">
        <h2>Habitaciones asignadas</h2>
        <p>Controla las habitaciones que tienes a cargo hoy.</p>
      </div>

      <div className="admin-card room-card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Hab.</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {assignedRooms.map((room) => (
                <tr key={room.id}>
                  <td>{room.room}</td>
                  <td>{room.type}</td>
                  <td>{room.status}</td>
                  <td>
                    <button className="table-btn">Ver Detalles</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
