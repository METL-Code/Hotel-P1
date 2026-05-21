import React, { useState } from 'react';
import type { ClientType } from '../../context/DataContext';
import { useData } from '../../context/DataContext';

export const AdminReservations: React.FC = () => {
  const { reservations, rooms, addReservation, deleteReservation } = useData();
  const [filter, setFilter] = useState<'Todas' | 'Confirmada' | 'Pendiente' | 'Cancelada'>('Todas');

  const [guest, setGuest] = useState('');
  const [room, setRoom] = useState('');
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');
  const [reservationPrice, setReservationPrice] = useState<number | ''>('');
  const [clientType, setClientType] = useState<ClientType>('Persona comun');
  const [statusNew, setStatusNew] = useState<'Confirmada' | 'Pendiente' | 'Cancelada'>('Pendiente');
  const [conflictMessage, setConflictMessage] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedCalendarRoom, setSelectedCalendarRoom] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const parseLocalDate = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const formatDateValue = (year: number, month: number, day: number) => (
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  );

  const handleAddReservation = (e: React.FormEvent) => {
    e.preventDefault();
    const guestName = guest.trim();
    const roomNumber = room.trim();
    if (!guestName || !roomNumber || !checkin || !checkout || reservationPrice === '') return;

    const alreadyReserved = reservations.some((reservation) => (
      reservation.status !== 'Cancelada' &&
      reservation.room.trim().toLowerCase() === roomNumber.toLowerCase() &&
      checkin <= reservation.checkout &&
      checkout >= reservation.checkin
    ));

    if (alreadyReserved) {
      setConflictMessage(`La habitacion ${roomNumber} ya tiene una reserva activa para el ${checkin}.`);
      return;
    }

    addReservation({ guest: guestName, room: roomNumber, price: Number(reservationPrice), clientType, status: statusNew, checkin, checkout });
    setGuest('');
    setRoom('');
    setCheckin('');
    setCheckout('');
    setReservationPrice('');
    setClientType('Persona comun');
    setStatusNew('Pendiente');
  };

  const handleDeleteReservation = (id: number) => {
    if (!confirm('¿Eliminar reservación?')) return;
    deleteReservation(id);
  };

  const confirmedReservations = reservations.filter((item) => item.status === 'Confirmada').length;
  const pendingReservations = reservations.filter((item) => item.status === 'Pendiente').length;
  const canceledReservations = reservations.filter((item) => item.status === 'Cancelada').length;
  const filtered = filter === 'Todas' ? reservations : reservations.filter((item) => item.status === filter);
  const currentMonth = calendarMonth.getMonth();
  const currentYear = calendarMonth.getFullYear();
  const monthLabel = calendarMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const calendarOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const calendarDays = Array.from({ length: calendarOffset + daysInMonth }, (_, index) => {
    const day = index - calendarOffset + 1;
    return day > 0 ? day : null;
  });
  const reservedDays = new Set(
    reservations
      .filter((reservation) => (
        reservation.status !== 'Cancelada' &&
        reservation.room.trim().toLowerCase() === selectedCalendarRoom.trim().toLowerCase()
      ))
      .flatMap((reservation) => {
        const start = parseLocalDate(reservation.checkin);
        const end = parseLocalDate(reservation.checkout);
        const days: string[] = [];

        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
          if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
            days.push(String(date.getDate()).padStart(2, '0'));
          }
        }

        return days;
      })
  );

  const getReservationsForDay = (day: number) => {
    const dateValue = formatDateValue(currentYear, currentMonth, day);
    const selectedRoom = selectedCalendarRoom.trim().toLowerCase();

    return reservations.filter((reservation) => (
      reservation.status !== 'Cancelada' &&
      reservation.room.trim().toLowerCase() === selectedRoom &&
      dateValue >= reservation.checkin &&
      dateValue <= reservation.checkout
    ));
  };

  const changeCalendarMonth = (direction: -1 | 1) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  const openCalendar = () => {
    setSelectedCalendarRoom(rooms[0]?.number ?? '');
    setCalendarMonth(new Date());
    setCalendarOpen(true);
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>Reservaciones</h2>
        <p>Controla el estado de cada reserva y revisa información de llegada.</p>
      </div>

      <div className="admin-grid">
        <div className="admin-card form-section">
          <h3>Crear nueva reservación</h3>
          <p>Ingresa la información del huésped y las fechas para generar una reserva.</p>
          <form onSubmit={handleAddReservation} className="admin-form form-grid">
            <label>
              Huésped
              <input value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="Nombre del huésped" />
            </label>
            <label>
              Habitación
              <select value={room} onChange={(e) => setRoom(e.target.value)}>
                <option value="">Selecciona una habitacion</option>
                {rooms.map((roomItem) => (
                  <option key={roomItem.id} value={roomItem.number}>
                    {roomItem.number} - {roomItem.type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Valor
              <input type="number" min="0" value={reservationPrice} onChange={(e) => setReservationPrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Valor acordado" />
            </label>
            <label>
              Tipo de persona
              <select value={clientType} onChange={(e) => setClientType(e.target.value as ClientType)}>
                <option value="Persona comun">Persona comun</option>
                <option value="Persona recurrente">Persona recurrente</option>
              </select>
            </label>
            <label>
              Check-in
              <input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} />
            </label>
            <label>
              Check-out
              <input type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} />
            </label>
            <label>
              Estado
              <select value={statusNew} onChange={(e) => setStatusNew(e.target.value as any)}>
                <option value="Pendiente">Pendiente</option>
                <option value="Confirmada">Confirmada</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </label>
            <button type="submit" className="admin-action-btn" style={{ gridColumn: '1 / -1' }}>
              Crear Reservación
            </button>
          </form>
        </div>

        <div className="admin-card summary-card">
          <h3>Resumen de reservaciones</h3>
          <p>Total de reservas: <strong>{reservations.length}</strong></p>
          <p>Confirmadas: <strong>{confirmedReservations}</strong></p>
          <p>Pendientes: <strong>{pendingReservations}</strong></p>
          <p>Canceladas: <strong>{canceledReservations}</strong></p>
          <label>
            Filtrar por estado
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
              <option value="Todas">Todas</option>
              <option value="Confirmada">Confirmada</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </label>
          <button type="button" className="admin-action-btn reservations-calendar-btn" onClick={openCalendar}>
            Calendario
          </button>
        </div>
      </div>

      <div className="admin-card reservation-card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Huésped</th>
                <th>Hab.</th>
                <th>Valor</th>
                <th>Persona</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((reservation) => (
                <tr key={reservation.id}>
                  <td>{reservation.id}</td>
                  <td>{reservation.guest}</td>
                  <td>{reservation.room}</td>
                  <td>${reservation.price ?? 0}</td>
                  <td>{reservation.clientType ?? 'Persona comun'}</td>
                  <td>{reservation.checkin}</td>
                  <td>{reservation.checkout}</td>
                  <td>{reservation.status}</td>
                  <td>
                    <button onClick={() => handleDeleteReservation(reservation.id)} className="table-btn" style={{ background: '#ef4444', color: 'white' }}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {conflictMessage && (
        <div className="dashboard-modal-overlay" onClick={() => setConflictMessage('')}>
          <div className="dashboard-modal reservation-alert-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Reserva no disponible</h3>
              <button className="modal-close" onClick={() => setConflictMessage('')}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>{conflictMessage}</p>
              <button className="admin-action-btn" onClick={() => setConflictMessage('')}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {calendarOpen && (
        <div className="dashboard-modal-overlay" onClick={() => setCalendarOpen(false)}>
          <div className="dashboard-modal reservations-calendar-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Calendario de reservas</h3>
              <button className="modal-close" onClick={() => setCalendarOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <label className="calendar-room-field">
                Habitacion
                <select value={selectedCalendarRoom} onChange={(event) => setSelectedCalendarRoom(event.target.value)}>
                  {rooms.map((roomItem) => (
                    <option key={roomItem.id} value={roomItem.number}>
                      {roomItem.number} - {roomItem.type}
                    </option>
                  ))}
                </select>
              </label>

              {rooms.length ? (
                <>
                  <div className="calendar-toolbar">
                    <button type="button" className="table-btn" onClick={() => changeCalendarMonth(-1)}>
                      Anterior
                    </button>
                    <strong>{monthLabel}</strong>
                    <button type="button" className="table-btn" onClick={() => changeCalendarMonth(1)}>
                      Siguiente
                    </button>
                  </div>

                  <div className="reservation-calendar-grid">
                    {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((dayName) => (
                      <div key={dayName} className="calendar-weekday">{dayName}</div>
                    ))}
                    {calendarDays.map((day, index) => {
                      const dayReservations = day !== null ? getReservationsForDay(day) : [];
                      const isReserved = day !== null && reservedDays.has(String(day).padStart(2, '0'));
                      return (
                        <div key={`${day ?? 'empty'}-${index}`} className={`calendar-day ${isReserved ? 'calendar-day-reserved' : ''}`}>
                          {day}
                          {day !== null && dayReservations.length > 0 ? (
                            <div className="calendar-day-tooltip">
                              {dayReservations.map((reservation) => (
                                <div key={reservation.id} className="calendar-tooltip-item">
                                  <strong>{reservation.guest}</strong>
                                  <span>Habitacion {reservation.room}</span>
                                  <span>Valor: ${reservation.price ?? 0}</span>
                                  <span>{reservation.clientType ?? 'Persona comun'}</span>
                                  <span>{reservation.status}</span>
                                  <span>{reservation.checkin} - {reservation.checkout}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="calendar-legend">
                    <span className="calendar-legend-dot" />
                    Dia reservado
                  </div>
                </>
              ) : (
                <p className="modal-empty">No hay habitaciones creadas.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
