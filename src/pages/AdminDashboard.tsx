// Dashboard principal compartido por Administrador y Trabajador.
// Se ve en /admin/dashboard y /trabajador/dashboard.
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ClientType } from '../context/DataContext';
import { useData } from '../context/DataContext';
import { formatMoney, todayDate } from '../utils/format';
import './AdminDashboard.css';

type ModalType = 'rooms' | 'reservations' | null;
type RoomFilter = 'Disponible' | 'Ocupada' | 'Mantenimiento';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const {
    rooms,
    reservations,
    loading,
    error,
    clearError,
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

  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const availableRooms = rooms.filter((room) => room.status === 'Disponible').length;
  const occupiedRooms = rooms.filter((room) => room.status === 'Ocupada').length;
  const maintenanceRooms = rooms.filter((room) => room.status === 'Mantenimiento').length;

  const today = todayDate();
  const activeReservations = reservations.filter((reservation) => reservation.status !== 'Cancelada');
  const todayReservations = activeReservations.filter((reservation) => reservation.checkin <= today);
  const upcomingReservations = activeReservations.filter((reservation) => reservation.checkin > today);
  const visibleReservations = reservationFilter === 'today' ? todayReservations : upcomingReservations;
  const visibleRooms = rooms.filter((room) => room.status === roomFilter);

  const isWorkerPanel = location.pathname.startsWith('/trabajador');
  const panelPath = isWorkerPanel ? '/trabajador' : '/admin';
  const panelRoleLabel = isWorkerPanel ? 'Usuario' : 'Administrador';

  const openRoomsModal = (title: string, filter: RoomFilter) => {
    clearError();
    setLocalError(null);
    setModalTitle(title);
    setRoomFilter(filter);
    setModalType('rooms');
    setModalOpen(true);
  };

  const openReservationsModal = (title: string, filter: 'today' | 'upcoming') => {
    clearError();
    setLocalError(null);
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
    setLocalError(null);
    clearError();
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
    setLocalError(null);
  };

  const confirmRoomAvailable = async () => {
    if (availableRoomId === null || submitting) return;
    if (!availableReasonText.trim()) {
      setLocalError('Escribe un motivo para pasar la habitacion a Disponible.');
      return;
    }

    setLocalError(null);
    setSubmitting(true);
    const saved = await updateRoomStatus(availableRoomId, 'Disponible', availableReasonText.trim());
    setSubmitting(false);
    if (!saved) return;
    setAvailableRoomId(null);
    setAvailableReasonText('');
  };

  const finishRoomStay = async (roomId: number) => {
    if (submitting) return;
    if (!confirm('¿Finalizar la estancia y marcar la habitacion como Disponible? El ingreso se conservara en los informes.')) return;
    setLocalError(null);
    setSubmitting(true);
    await updateRoomStatus(roomId, 'Disponible', 'Estancia finalizada');
    setSubmitting(false);
  };

  const sendRoomToMaintenance = async (roomId: number) => {
    if (submitting) return;
    setLocalError(null);
    setSubmitting(true);
    await setRoomMaintenance(roomId);
    setSubmitting(false);
  };

  const handleGuestLookup = () => {
    if (!cedula.trim()) {
      setGuestLookupMsg('Escribe una cedula para buscar.');
      return;
    }
    const found = findGuestByCedula(cedula.trim());
    if (found) {
      setNombres(found.nombres);
      setApellidos(found.apellidos);
      setEmail(found.email ?? '');
      setGuestLookupMsg('Huesped encontrado y cargado desde SQL Server.');
    } else {
      setGuestLookupMsg('No existe huesped con esa cedula. Completa los datos para crear uno.');
    }
  };

  const confirmOccupancy = async () => {
    if (occupyingRoomId === null || submitting) return;
    if (!cedula.trim() || !nombres.trim() || !apellidos.trim() || occupancyPrice === '' || Number(occupancyPrice) <= 0) {
      setLocalError('Cedula, nombres, apellidos y un valor mayor a cero son obligatorios.');
      return;
    }

    setLocalError(null);
    setSubmitting(true);
    const saved = await occupyRoomWithGuest(
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
    setSubmitting(false);
    if (saved) resetOccupancyForm();
  };

  const beginOccupancy = (roomId: number) => {
    setOccupyingRoomId(roomId);
    setCancelingRoomId(null);
    setAvailableRoomId(null);
    setCedula('');
    setNombres('');
    setApellidos('');
    setEmail('');
    setOccupancyPrice('');
    setOccupancyClientType('Persona comun');
    setGuestLookupMsg(null);
    setLocalError(null);
  };

  const handleConfirmArrival = async (reservationId: number) => {
    if (submitting) return;
    setLocalError(null);
    setSubmitting(true);
    await updateReservationStatus(reservationId, 'Confirmada');
    setSubmitting(false);
  };

  const handleCancelReservation = async () => {
    if (cancelingReservationId === null || submitting) return;
    if (!cancelReasonText.trim()) {
      setLocalError('Escribe un motivo para cancelar la reservacion.');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    const saved = await updateReservationStatus(cancelingReservationId, 'Cancelada', cancelReasonText.trim());
    setSubmitting(false);
    if (!saved) return;
    setCancelingReservationId(null);
    setCancelReasonText('');
  };

  const handleCancelRoomOccupancy = async () => {
    if (cancelingRoomId === null || submitting) return;
    if (!cancelRoomReason.trim()) {
      setLocalError('Escribe un motivo para anular la entrada.');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    const saved = await cancelRoomOccupancy(cancelingRoomId, cancelRoomReason.trim());
    setSubmitting(false);
    if (!saved) return;
    setCancelingRoomId(null);
    setCancelRoomReason('');
  };

  const activeError = localError || error;

  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <div>
          <h2>Bienvenido, {user?.username}!</h2>
          <p>Revisa los indicadores clave en tiempo real desde SQL Server.</p>
        </div>
        <div className={`dashboard-badge ${isWorkerPanel ? 'worker-badge' : ''}`}>{panelRoleLabel}</div>
      </div>

      {!modalOpen && error ? (
        <div className="feedback-banner feedback-error">{error}</div>
      ) : null}

      {loading && !rooms.length ? (
        <div className="feedback-banner feedback-info">Cargando datos desde SQL Server...</div>
      ) : null}

      <div className="stats-grid">
        <button type="button" className="stat-card" onClick={() => openRoomsModal('Habitaciones Disponibles', 'Disponible')}>
          <div className="stat-icon">🏨</div>
          <div className="stat-content">
            <h3>Habitaciones Disponibles</h3>
            <p className="stat-number">{availableRooms}</p>
          </div>
        </button>
        <button type="button" className="stat-card" onClick={() => openRoomsModal('Habitaciones Ocupadas', 'Ocupada')}>
          <div className="stat-icon">🛏️</div>
          <div className="stat-content">
            <h3>Habitaciones Ocupadas</h3>
            <p className="stat-number">{occupiedRooms}</p>
          </div>
        </button>
        <button type="button" className="stat-card" onClick={() => openRoomsModal('Habitaciones en Mantenimiento', 'Mantenimiento')}>
          <div className="stat-icon">🛠️</div>
          <div className="stat-content">
            <h3>Habitaciones en Mantenimiento</h3>
            <p className="stat-number">{maintenanceRooms}</p>
          </div>
        </button>
        <button type="button" className="stat-card" onClick={() => openReservationsModal('Reservaciones Hoy y Pendientes', 'today')}>
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>Reservaciones Hoy</h3>
            <p className="stat-number">{todayReservations.length}</p>
          </div>
        </button>
        <button type="button" className="stat-card" onClick={() => openReservationsModal('Proximas Reservas', 'upcoming')}>
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <h3>Proximas Reservas</h3>
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
              <Link to={`${panelPath}/auditoria`} className="action-btn"><span className="action-icon">🔍</span>Auditoria</Link>
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
              <button type="button" className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-content">
              {activeError ? (
                <div className="feedback-banner feedback-error" style={{ marginBottom: 14 }}>{activeError}</div>
              ) : null}

              {modalType === 'reservations' ? (
                visibleReservations.length ? (
                  <ul className="modal-list">
                    {visibleReservations.map((reservation) => {
                      const isOverdue = reservation.checkin < today;
                      return (
                        <li key={reservation.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <strong>Reserva #{reservation.id}</strong>
                              <span className={`status-pill ${reservation.status === 'Confirmada' ? 'status-confirmada' : 'status-pendiente'}`}>
                                {reservation.status}
                              </span>
                              {isOverdue ? <span className="status-pill status-atrasada">Atrasada</span> : null}
                            </div>
                            <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{reservation.guest} - Habitacion {reservation.room}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>
                              Valor: {formatMoney(reservation.price ?? 0)} - {reservation.clientType ?? 'Persona comun'}
                            </div>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{reservation.checkin} a {reservation.checkout}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              className="table-btn btn-success"
                              disabled={submitting}
                              onClick={() => handleConfirmArrival(reservation.id)}
                            >
                              Confirmar llegada
                            </button>
                            <button
                              type="button"
                              className="table-btn btn-danger"
                              disabled={submitting}
                              onClick={() => {
                                setCancelingReservationId(reservation.id);
                                setCancelReasonText('');
                                setLocalError(null);
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="modal-empty">No hay reservaciones para mostrar.</p>
                )
              ) : null}

              {modalType === 'reservations' && cancelingReservationId !== null ? (
                <div style={{ marginTop: 14 }}>
                  <h4>Motivo de cancelacion (Reserva #{cancelingReservationId})</h4>
                  <textarea
                    value={cancelReasonText}
                    onChange={(event) => setCancelReasonText(event.target.value)}
                    placeholder="Escribe el motivo"
                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 8 }}
                  />
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button type="button" className="admin-action-btn" disabled={submitting} onClick={handleCancelReservation}>
                      {submitting ? 'Guardando...' : 'Confirmar cancelacion'}
                    </button>
                    <button type="button" className="table-btn" onClick={() => setCancelingReservationId(null)}>Volver</button>
                  </div>
                </div>
              ) : null}

              {modalType === 'rooms' ? (
                <div>
                  {visibleRooms.length ? (
                    <ul className="modal-list">
                      {visibleRooms.map((room) => (
                        <li key={room.id} style={{ display: 'grid', gap: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                              <strong>Hab {room.number}</strong>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                                <span style={{ fontSize: 13, color: '#475569' }}>{room.type}</span>
                                <span className={`status-pill ${room.status === 'Disponible' ? 'status-disponible' : room.status === 'Ocupada' ? 'status-ocupada' : 'status-mantenimiento'}`}>
                                  {room.status}
                                </span>
                              </div>
                              {room.note ? <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Nota: {room.note}</div> : null}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {room.status === 'Mantenimiento' ? (
                                <button
                                  type="button"
                                  className="table-btn btn-success"
                                  disabled={submitting}
                                  onClick={() => {
                                    setAvailableRoomId(room.id);
                                    setAvailableReasonText('');
                                    setLocalError(null);
                                  }}
                                >
                                  Disponible
                                </button>
                              ) : null}
                              {room.status === 'Disponible' ? (
                                <button
                                  type="button"
                                  className="table-btn btn-success"
                                  disabled={submitting}
                                  onClick={() => beginOccupancy(room.id)}
                                >
                                  Ocupar
                                </button>
                              ) : null}
                              {room.status === 'Ocupada' ? (
                                <button
                                  type="button"
                                  className="table-btn btn-success"
                                  disabled={submitting}
                                  onClick={() => finishRoomStay(room.id)}
                                >
                                  Finalizar
                                </button>
                              ) : null}
                              {room.status !== 'Mantenimiento' ? (
                                <button
                                  type="button"
                                  className="table-btn btn-warning"
                                  disabled={submitting}
                                  onClick={() => sendRoomToMaintenance(room.id)}
                                >
                                  Mant.
                                </button>
                              ) : null}
                              {room.status === 'Ocupada' ? (
                                <button
                                  type="button"
                                  className="table-btn btn-danger"
                                  disabled={submitting}
                                  onClick={() => {
                                    setCancelingRoomId(room.id);
                                    setCancelRoomReason('');
                                    setLocalError(null);
                                  }}
                                >
                                  Anular
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {occupyingRoomId === room.id ? (
                            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                              <h4>Ocupar habitacion - Datos del huesped</h4>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                                <div>
                                  <label>Cedula</label>
                                  <input
                                    value={cedula}
                                    onChange={(event) => setCedula(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault();
                                        handleGuestLookup();
                                      }
                                    }}
                                    placeholder="Cedula"
                                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                                  />
                                </div>
                                <div style={{ alignSelf: 'end' }}>
                                  <button type="button" className="table-btn" onClick={handleGuestLookup}>
                                    Buscar
                                  </button>
                                </div>
                                <div>
                                  <label>Nombres</label>
                                  <input value={nombres} onChange={(event) => setNombres(event.target.value)} placeholder="Nombres" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }} />
                                </div>
                                <div>
                                  <label>Apellidos</label>
                                  <input value={apellidos} onChange={(event) => setApellidos(event.target.value)} placeholder="Apellidos" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }} />
                                </div>
                                <div>
                                  <label>Valor</label>
                                  <input type="number" min="1" value={occupancyPrice} onChange={(event) => setOccupancyPrice(event.target.value === '' ? '' : Number(event.target.value))} placeholder="Valor acordado" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }} />
                                </div>
                                <div>
                                  <label>Tipo de persona</label>
                                  <select value={occupancyClientType} onChange={(event) => setOccupancyClientType(event.target.value as ClientType)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}>
                                    <option value="Persona comun">Persona comun</option>
                                    <option value="Persona recurrente">Persona recurrente</option>
                                  </select>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <label>Correo (opcional)</label>
                                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }} />
                                </div>
                              </div>
                              {guestLookupMsg ? <div style={{ marginTop: 8, color: '#334155', fontSize: 13 }}>{guestLookupMsg}</div> : null}
                              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                                <button type="button" className="admin-action-btn" disabled={submitting} onClick={confirmOccupancy}>
                                  {submitting ? 'Guardando...' : 'Confirmar ocupacion'}
                                </button>
                                <button type="button" className="table-btn" onClick={resetOccupancyForm}>Cancelar</button>
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
                    <div style={{ marginTop: 14 }}>
                      <h4>Motivo para volver a Disponible</h4>
                      <textarea
                        value={availableReasonText}
                        onChange={(event) => setAvailableReasonText(event.target.value)}
                        placeholder="Escribe el motivo (ej. Ya esta limpia)"
                        style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 8 }}
                      />
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button type="button" className="admin-action-btn" disabled={submitting} onClick={confirmRoomAvailable}>
                          {submitting ? 'Guardando...' : 'Confirmar disponible'}
                        </button>
                        <button type="button" className="table-btn" onClick={() => setAvailableRoomId(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : null}

                  {cancelingRoomId !== null ? (
                    <div style={{ marginTop: 14 }}>
                      <h4>Motivo de anulacion de entrada</h4>
                      <textarea
                        value={cancelRoomReason}
                        onChange={(event) => setCancelRoomReason(event.target.value)}
                        placeholder="Escribe el motivo"
                        style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 8 }}
                      />
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button type="button" className="admin-action-btn" disabled={submitting} onClick={handleCancelRoomOccupancy}>
                          {submitting ? 'Guardando...' : 'Confirmar anulacion'}
                        </button>
                        <button type="button" className="table-btn" onClick={() => setCancelingRoomId(null)}>Cancelar</button>
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
