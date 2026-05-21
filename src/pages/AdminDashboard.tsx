import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { ClientType } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import './AdminDashboard.css';

type RoomFilter = 'Disponible' | 'Ocupada' | 'Mantenimiento';
type ModalType = 'rooms' | 'reservations' | null;

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const {
    rooms,
    reservations,
    updateReservationStatus,
    findGuestByCedula,
    occupyRoomWithGuest,
    cancelRoomOccupancy,
    updateRoomStatus,
    setRoomMaintenance
  } = useData();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalType, setModalType] = useState<ModalType>(null);
  const [roomFilter, setRoomFilter] = useState<RoomFilter>('Disponible');
  const [reservationFilter, setReservationFilter] = useState<'today' | 'upcoming'>('today');
  const [cancelingReservationId, setCancelingReservationId] = useState<number | null>(null);
  const [cancelReasonText, setCancelReasonText] = useState('');
  const [cancelingRoomId, setCancelingRoomId] = useState<number | null>(null);
  const [cancelRoomReason, setCancelRoomReason] = useState('');
  const [availableRoomId, setAvailableRoomId] = useState<number | null>(null);
  const [availableReasonText, setAvailableReasonText] = useState('');
  const [occupyingRoomId, setOccupyingRoomId] = useState<number | null>(null);
  const [cedula, setCedula] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email, setEmail] = useState('');
  const [occupancyPrice, setOccupancyPrice] = useState<number | ''>('');
  const [occupancyClientType, setOccupancyClientType] = useState<ClientType>('Persona comun');
  const [guestLookupMsg, setGuestLookupMsg] = useState<string | null>(null);

  const availableRooms = rooms.filter((room) => room.status === 'Disponible').length;
  const occupiedRooms = rooms.filter((room) => room.status === 'Ocupada').length;
  const maintenanceRooms = rooms.filter((room) => room.status === 'Mantenimiento').length;
  const today = localDate();
  const todayReservations = reservations.filter((reservation) => reservation.checkin === today);
  const upcomingReservations = reservations.filter((reservation) => reservation.checkin > today);
  const visibleReservations = reservationFilter === 'today' ? todayReservations : upcomingReservations;
  const visibleRooms = rooms.filter((room) => room.status === roomFilter);
  const isWorkerPanel = location.pathname.startsWith('/trabajador');
  const panelPath = isWorkerPanel ? '/trabajador' : '/admin';
  const panelRoleLabel = isWorkerPanel ? 'Usuario' : 'Administrador';

  const openRoomsModal = (title: string, filter: RoomFilter) => {
    setModalTitle(title);
    setRoomFilter(filter);
    setModalType('rooms');
    setModalOpen(true);
  };

  const openReservationsModal = (title: string, filter: 'today' | 'upcoming') => {
    setModalTitle(title);
    setReservationFilter(filter);
    setModalType('reservations');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalType(null);
    setCancelingReservationId(null);
    setCancelingRoomId(null);
    setAvailableRoomId(null);
    setOccupyingRoomId(null);
  };

  const resetOccupancyForm = () => {
    setOccupyingRoomId(null);
    setCedula('');
    setNombres('');
    setApellidos('');
    setEmail('');
    setOccupancyPrice('');
    setOccupancyClientType('Persona comun');
    setGuestLookupMsg(null);
  };

  const confirmRoomAvailable = () => {
    if (availableRoomId === null) return;
    if (!availableReasonText.trim()) {
      alert('Escribe un motivo.');
      return;
    }

    updateRoomStatus(availableRoomId, 'Disponible', availableReasonText.trim());
    setAvailableRoomId(null);
    setAvailableReasonText('');
  };

  const confirmOccupancy = () => {
    if (occupyingRoomId === null) return;
    if (!cedula.trim() || !nombres.trim() || !apellidos.trim() || occupancyPrice === '' || Number(occupancyPrice) <= 0) {
      alert('Cedula, nombres, apellidos y un valor mayor a cero son obligatorios.');
      return;
    }

    occupyRoomWithGuest(
      occupyingRoomId,
      {
        cedula: cedula.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        email: email.trim() || undefined
      },
      Number(occupancyPrice),
      occupancyClientType
    );
    resetOccupancyForm();
  };

  const beginOccupancy = (roomId: number) => {
    setOccupyingRoomId(roomId);
    setCedula('');
    setNombres('');
    setApellidos('');
    setEmail('');
    setOccupancyPrice('');
    setOccupancyClientType('Persona comun');
    setGuestLookupMsg(null);
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <div>
          <h2>Bienvenido, {user?.username}!</h2>
          <p>Revisa los indicadores clave y accede rapido a tu area.</p>
        </div>
        <div className={`dashboard-badge ${isWorkerPanel ? 'worker-badge' : ''}`}>{panelRoleLabel}</div>
      </div>

      <div className="stats-grid">
        <button className="stat-card" onClick={() => openRoomsModal('Habitaciones Disponibles', 'Disponible')}>
          <div className="stat-icon">🏨</div>
          <div className="stat-content">
            <h3>Habitaciones Disponibles</h3>
            <p className="stat-number">{availableRooms}</p>
          </div>
        </button>
        <button className="stat-card" onClick={() => openRoomsModal('Habitaciones Ocupadas', 'Ocupada')}>
          <div className="stat-icon">🛏️</div>
          <div className="stat-content">
            <h3>Habitaciones Ocupadas</h3>
            <p className="stat-number">{occupiedRooms}</p>
          </div>
        </button>
        <button className="stat-card" onClick={() => openRoomsModal('Habitaciones en Mantenimiento', 'Mantenimiento')}>
          <div className="stat-icon">🛠️</div>
          <div className="stat-content">
            <h3>Habitaciones en Mantenimiento</h3>
            <p className="stat-number">{maintenanceRooms}</p>
          </div>
        </button>
        <button className="stat-card" onClick={() => openReservationsModal('Reservaciones Hoy', 'today')}>
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>Reservaciones Hoy</h3>
            <p className="stat-number">{todayReservations.length}</p>
          </div>
        </button>
        <button className="stat-card" onClick={() => openReservationsModal('Reservas', 'upcoming')}>
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <h3>Reservas</h3>
            <p className="stat-number">{upcomingReservations.length}</p>
          </div>
        </button>
      </div>

      <div className="admin-actions">
        <h3>Acciones rapidas</h3>
        <div className="actions-grid">
          {!isWorkerPanel ? (
            <>
              <Link to={`${panelPath}/usuarios`} className="action-btn"><span className="action-icon">👥</span>Usuarios</Link>
              <Link to={`${panelPath}/habitaciones`} className="action-btn"><span className="action-icon">🏨</span>Habitaciones</Link>
            </>
          ) : null}
          <Link to={`${panelPath}/reservaciones`} className="action-btn"><span className="action-icon">📅</span>Reservaciones</Link>
          {!isWorkerPanel ? (
            <>
              <Link to={`${panelPath}/informe-diario`} className="action-btn"><span className="action-icon">💵</span>Informe Diario</Link>
              <Link to={`${panelPath}/informe-mensual`} className="action-btn"><span className="action-icon">📊</span>Informe Mensual</Link>
            </>
          ) : null}
          <Link to={`${panelPath}/configuracion`} className="action-btn"><span className="action-icon">⚙️</span>Configuracion</Link>
        </div>
      </div>

      {modalOpen && (
        <div className="dashboard-modal-overlay" onClick={closeModal}>
          <div className="dashboard-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalTitle}</h3>
              <button className="modal-close" onClick={closeModal}>x</button>
            </div>
            <div className="modal-content">
              {modalType === 'reservations' ? (
                visibleReservations.length ? (
                  <ul className="modal-list">
                    {visibleReservations.map((reservation) => (
                      <li key={reservation.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <div>
                          <strong>Reserva {reservation.id}</strong>
                          <div style={{ fontSize: 13, color: '#475569' }}>{reservation.guest} - Habitacion {reservation.room}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>Valor: ${reservation.price ?? 0} - {reservation.clientType ?? 'Persona comun'}</div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>{reservation.checkin} - {reservation.checkout}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="table-btn" onClick={() => updateReservationStatus(reservation.id, 'Confirmada')}>
                            Confirmar llegada
                          </button>
                          <button className="table-btn" style={{ background: '#ef4444', color: 'white' }} onClick={() => { setCancelingReservationId(reservation.id); setCancelReasonText(''); }}>
                            Cancelar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="modal-empty">No hay reservaciones para mostrar.</p>
                )
              ) : null}

              {modalType === 'reservations' && cancelingReservationId !== null ? (
                <div style={{ marginTop: 12 }}>
                  <h4>Motivo de cancelacion</h4>
                  <textarea value={cancelReasonText} onChange={(event) => setCancelReasonText(event.target.value)} placeholder="Escribe el motivo" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button className="admin-action-btn" onClick={() => {
                      if (!cancelReasonText.trim()) {
                        alert('Escribe un motivo.');
                        return;
                      }
                      updateReservationStatus(cancelingReservationId, 'Cancelada', cancelReasonText.trim());
                      setCancelingReservationId(null);
                      setCancelReasonText('');
                    }}>
                      Confirmar cancelacion
                    </button>
                    <button className="table-btn" onClick={() => setCancelingReservationId(null)}>Cancelar</button>
                  </div>
                </div>
              ) : null}

              {modalType === 'rooms' ? (
                <div>
                  {visibleRooms.length ? (
                    <ul className="modal-list">
                      {visibleRooms.map((room) => (
                        <li key={room.id} style={{ display: 'grid', gap: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                            <div>
                              <strong>Hab {room.number}</strong>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                                <span style={{ fontSize: 13, color: '#475569' }}>{room.type}</span>
                                <span className={`status-pill ${room.status === 'Disponible' ? 'status-disponible' : room.status === 'Ocupada' ? 'status-ocupada' : 'status-mantenimiento'}`}>{room.status}</span>
                              </div>
                              {room.note ? <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Nota: {room.note}</div> : null}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {room.status === 'Mantenimiento' ? (
                                <button className="table-btn" onClick={() => { setAvailableRoomId(room.id); setAvailableReasonText(''); }}>Disponible</button>
                              ) : null}
                              {room.status !== 'Ocupada' ? (
                                <button className="table-btn" onClick={() => beginOccupancy(room.id)}>Ocupar</button>
                              ) : null}
                              {room.status !== 'Mantenimiento' ? (
                                <button className="table-btn" onClick={() => setRoomMaintenance(room.id)}>Mant.</button>
                              ) : null}
                              {room.status === 'Ocupada' ? (
                                <button className="table-btn" style={{ background: '#ef4444', color: 'white' }} onClick={() => { setCancelingRoomId(room.id); setCancelRoomReason(''); }}>Cancelar</button>
                              ) : null}
                            </div>
                          </div>
                          {occupyingRoomId === room.id ? (
                            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                              <h4>Ocupar habitacion - Datos del huesped</h4>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                                <div>
                                  <label>Cedula</label>
                                  <input value={cedula} onChange={(event) => setCedula(event.target.value)} placeholder="Cedula" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }} />
                                </div>
                                <div style={{ alignSelf: 'end' }}>
                                  <button className="table-btn" onClick={() => {
                                    if (!cedula.trim()) {
                                      setGuestLookupMsg('Escribe una cedula para buscar.');
                                      return;
                                    }
                                    const found = findGuestByCedula(cedula.trim());
                                    if (found) {
                                      setNombres(found.nombres);
                                      setApellidos(found.apellidos);
                                      setEmail(found.email ?? '');
                                      setGuestLookupMsg('Huesped encontrado y cargado.');
                                    } else {
                                      setGuestLookupMsg('No existe huesped con esa cedula. Completa los datos para crear uno.');
                                    }
                                  }}>
                                    Buscar
                                  </button>
                                </div>
                                <div>
                                  <label>Nombres</label>
                                  <input value={nombres} onChange={(event) => setNombres(event.target.value)} placeholder="Nombres" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }} />
                                </div>
                                <div>
                                  <label>Apellidos</label>
                                  <input value={apellidos} onChange={(event) => setApellidos(event.target.value)} placeholder="Apellidos" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }} />
                                </div>
                                <div>
                                  <label>Valor</label>
                                  <input type="number" min="0" value={occupancyPrice} onChange={(event) => setOccupancyPrice(event.target.value === '' ? '' : Number(event.target.value))} placeholder="Valor acordado" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }} />
                                </div>
                                <div>
                                  <label>Tipo de persona</label>
                                  <select value={occupancyClientType} onChange={(event) => setOccupancyClientType(event.target.value as ClientType)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                    <option value="Persona comun">Persona comun</option>
                                    <option value="Persona recurrente">Persona recurrente</option>
                                  </select>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <label>Correo (opcional)</label>
                                  <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }} />
                                </div>
                              </div>
                              {guestLookupMsg ? <div style={{ marginTop: 8, color: '#334155' }}>{guestLookupMsg}</div> : null}
                              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                                <button className="admin-action-btn" onClick={confirmOccupancy}>Confirmar ocupacion</button>
                                <button className="table-btn" onClick={resetOccupancyForm}>Cancelar</button>
                              </div>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="modal-empty">No hay habitaciones para mostrar.</p>
                  )}

                  {availableRoomId !== null ? (
                    <div style={{ marginTop: 12 }}>
                      <h4>Motivo para volver a Disponible</h4>
                      <textarea value={availableReasonText} onChange={(event) => setAvailableReasonText(event.target.value)} placeholder="Escribe el motivo" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button className="admin-action-btn" onClick={confirmRoomAvailable}>Confirmar disponible</button>
                        <button className="table-btn" onClick={() => setAvailableRoomId(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : null}

                  {cancelingRoomId !== null ? (
                    <div style={{ marginTop: 12 }}>
                      <h4>Motivo de cancelacion de entrada</h4>
                      <textarea value={cancelRoomReason} onChange={(event) => setCancelRoomReason(event.target.value)} placeholder="Escribe el motivo" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button className="admin-action-btn" onClick={() => {
                          if (!cancelRoomReason.trim()) {
                            alert('Escribe un motivo.');
                            return;
                          }
                          cancelRoomOccupancy(cancelingRoomId, cancelRoomReason.trim());
                          setCancelingRoomId(null);
                          setCancelRoomReason('');
                        }}>
                          Confirmar cancelacion
                        </button>
                        <button className="table-btn" onClick={() => setCancelingRoomId(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : null}

                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
