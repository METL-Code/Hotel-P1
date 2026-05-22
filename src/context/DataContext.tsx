// Contexto global de datos del hotel.
// Aqui se manejan habitaciones, usuarios, reservas, huespedes y reportes visibles en admin/trabajador.
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiGet, apiSend, isApiEnabled } from '../services/api';

// Modelo de habitacion visible en Dashboard, Habitaciones y modales.
export interface Room {
  id: number;
  number: string;
  type: string;
  status: 'Disponible' | 'Ocupada' | 'Mantenimiento';
  note?: string;
}

// Tipo de cliente usado para reservas, ocupaciones e informes.
export type ClientType = 'Persona comun' | 'Persona recurrente';

// Modelo de usuario administrable desde la pantalla Usuarios.
export interface AdminUser {
  id: number;
  nombres: string;
  apellidos: string;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'trabajador';
  status: 'Activo' | 'Inactivo';
}

// Modelo de reserva visible en Reservaciones y Dashboard.
export interface Reservation {
  id: number;
  guest: string;
  room: string;
  price?: number;
  clientType?: ClientType;
  status: 'Confirmada' | 'Pendiente' | 'Cancelada';
  checkin: string;
  checkout: string;
  cancellationReason?: string;
}

// Modelo de huesped usado al ocupar una habitacion desde el Dashboard.
export interface Guest {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  email?: string;
}

// Registro financiero de una entrada/ocupacion; alimenta informes diarios y mensuales.
export interface OccupancyEntry {
  id: number;
  roomId: number;
  roomNumber: string;
  guestName: string;
  price: number;
  clientType: ClientType;
  date: string;
  status: 'Activa' | 'Cancelada';
  cancellationReason?: string;
  canceledAt?: string;
}

interface RoomsResponse {
  rooms: Room[];
}

interface RoomResponse {
  room: Room;
}

interface GuestsResponse {
  guests: Guest[];
}

interface GuestResponse {
  guest: Guest;
}

interface ReservationsResponse {
  reservations: Reservation[];
}

interface ReservationResponse {
  reservation: Reservation;
}

interface OccupancyEntriesResponse {
  occupancyEntries: OccupancyEntry[];
}

interface OccupancyResponse {
  room?: Room | null;
  guest?: Guest | null;
  entry?: OccupancyEntry | null;
}

interface ReservationStatusResponse {
  reservation: Reservation;
  room?: Room | null;
  entry?: OccupancyEntry | null;
}

// Contrato completo de datos y acciones que reciben las pantallas con useData().
interface DataContextType {
  rooms: Room[];
  users: AdminUser[];
  reservations: Reservation[];
  guests: Guest[];
  occupancyEntries: OccupancyEntry[];
  addUser: (u: Omit<AdminUser, 'id' | 'status'>) => void;
  updateUser: (id: number, user: Omit<AdminUser, 'id' | 'status' | 'password'>) => void;
  toggleUserStatus: (id: number) => void;
  deleteUser: (id: number) => void;
  addRoom: (r: Omit<Room, 'id'>) => Promise<boolean>;
  updateRoomStatus: (id: number, status: Room['status'], note?: string) => Promise<boolean>;
  setRoomMaintenance: (id: number, note?: string) => Promise<boolean>;
  deleteRoom: (id: number) => Promise<boolean>;
  addGuest: (g: Omit<Guest, 'id'>) => Promise<Guest | undefined>;
  findGuestByCedula: (cedula: string) => Guest | undefined;
  occupyRoomWithGuest: (roomId: number, guest: Omit<Guest, 'id'>, price: number, clientType: ClientType) => Promise<boolean>;
  cancelRoomOccupancy: (roomId: number, reason: string) => Promise<boolean>;
  addReservation: (r: Omit<Reservation, 'id'>) => Promise<boolean>;
  updateReservationStatus: (id: number, status: Reservation['status'], reason?: string) => Promise<boolean>;
  updateRoomNote: (id: number, note: string) => Promise<boolean>;
  deleteReservation: (id: number) => Promise<boolean>;
}

// Contexto React que se llena en DataProvider y se consume con useData().
const DataContext = createContext<DataContextType | undefined>(undefined);

// Datos iniciales cuando no existe informacion previa en localStorage o SQL.
const initialRooms: Room[] = [
  { id: 1, number: '101', type: 'Doble', status: 'Disponible' },
  { id: 2, number: '102', type: 'Suite', status: 'Ocupada' },
  { id: 3, number: '103', type: 'Individual', status: 'Disponible' },
  { id: 4, number: '104', type: 'Doble', status: 'Mantenimiento' }
];

// Usuarios iniciales para pruebas locales del sistema.
const initialUsers: AdminUser[] = [
  { id: 1, nombres: 'Administrador', apellidos: 'Principal', username: 'admin', email: 'admin@hotel.com', password: 'admin123', role: 'admin', status: 'Activo' },
  { id: 2, nombres: 'Mariana', apellidos: 'Lopez', username: 'mariana', email: 'mariana@hotel.com', password: 'trabajador123', role: 'trabajador', status: 'Activo' },
  { id: 3, nombres: 'Carlos', apellidos: 'Perez', username: 'carlos', email: 'carlos@hotel.com', password: 'trabajador123', role: 'trabajador', status: 'Inactivo' }
];

// Reservas iniciales para que el panel tenga datos de ejemplo cuando no hay API.
const initialReservations: Reservation[] = [
  { id: 1, guest: 'Luis Fernandez', room: '101', status: 'Confirmada', checkin: '2026-06-01', checkout: '2026-06-05' },
  { id: 2, guest: 'Ana Gomez', room: '102', status: 'Pendiente', checkin: '2026-06-04', checkout: '2026-06-06' },
  { id: 3, guest: 'Mario Lopez', room: '103', status: 'Cancelada', checkin: '2026-06-10', checkout: '2026-06-12' }
];

// Devuelve la fecha local en formato YYYY-MM-DD para informes y registros.
const currentDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Calcula el siguiente ID numerico sin depender de una base de datos.
const nextId = (items: { id: number }[]) => items.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;

const readLocal = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};

const saveRoomsLocal = (rooms: Room[]) => localStorage.setItem('hotel_rooms', JSON.stringify(rooms));
const saveGuestsLocal = (guests: Guest[]) => localStorage.setItem('hotel_guests', JSON.stringify(guests));
const saveReservationsLocal = (reservations: Reservation[]) => localStorage.setItem('hotel_reservations', JSON.stringify(reservations));
const saveOccupancyEntriesLocal = (entries: OccupancyEntry[]) => localStorage.setItem('hotel_occupancy_entries', JSON.stringify(entries));

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Error inesperado';

// Provider de datos que envuelve la app en App.tsx.
// Mantiene estado en React y usa SQL Server cuando la API esta activa.
export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Estado de habitaciones; con API activa se reemplaza por GET /api/rooms.
  const [rooms, setRooms] = useState<Room[]>(() => readLocal('hotel_rooms', initialRooms));

  // Estado de usuarios locales; AdminUsers usa API directa cuando esta activada.
  const [users, setUsers] = useState<AdminUser[]>(() => {
    const parsed = readLocal<Partial<AdminUser>[]>('hotel_users', initialUsers);
    return parsed.map((user) => ({
      id: user.id ?? 0,
      nombres: user.nombres ?? user.username ?? '',
      apellidos: user.apellidos ?? '',
      username: user.username ?? '',
      email: user.email ?? '',
      password: user.password ?? (user.role === 'admin' ? 'admin123' : 'trabajador123'),
      role: user.role ?? 'trabajador',
      status: user.status ?? 'Activo'
    }));
  });

  // Estado de huespedes registrados por cedula.
  const [guests, setGuests] = useState<Guest[]>(() => readLocal('hotel_guests', []));

  // Estado de reservas; con API activa viene de dbo.Reservaciones.
  const [reservations, setReservations] = useState<Reservation[]>(() => readLocal('hotel_reservations', initialReservations));

  // Estado de entradas/ocupaciones; con API activa viene de dbo.EntradasOcupacion.
  const [occupancyEntries, setOccupancyEntries] = useState<OccupancyEntry[]>(() => readLocal('hotel_occupancy_entries', []));

  // Al arrancar con API activa, carga todos los datos operativos desde SQL Server.
  useEffect(() => {
    if (!isApiEnabled()) return;

    let active = true;
    Promise.all([
      apiGet<RoomsResponse>('/api/rooms'),
      apiGet<GuestsResponse>('/api/guests'),
      apiGet<ReservationsResponse>('/api/reservations'),
      apiGet<OccupancyEntriesResponse>('/api/occupancy')
    ])
      .then(([roomsData, guestsData, reservationsData, occupancyData]) => {
        if (!active) return;
        setRooms(roomsData.rooms);
        setGuests(guestsData.guests);
        setReservations(reservationsData.reservations);
        setOccupancyEntries(occupancyData.occupancyEntries);
        saveRoomsLocal(roomsData.rooms);
        saveGuestsLocal(guestsData.guests);
        saveReservationsLocal(reservationsData.reservations);
        saveOccupancyEntriesLocal(occupancyData.occupancyEntries);
      })
      .catch((error) => {
        console.warn('No se pudieron cargar datos desde SQL Server.', error);
      });

    return () => {
      active = false;
    };
  }, []);

  const setRoomsAndPersist = (updater: (previous: Room[]) => Room[]) => {
    setRooms((previous) => {
      const next = updater(previous);
      saveRoomsLocal(next);
      return next;
    });
  };

  const setGuestsAndPersist = (updater: (previous: Guest[]) => Guest[]) => {
    setGuests((previous) => {
      const next = updater(previous);
      saveGuestsLocal(next);
      return next;
    });
  };

  const setReservationsAndPersist = (updater: (previous: Reservation[]) => Reservation[]) => {
    setReservations((previous) => {
      const next = updater(previous);
      saveReservationsLocal(next);
      return next;
    });
  };

  const setOccupancyEntriesAndPersist = (updater: (previous: OccupancyEntry[]) => OccupancyEntry[]) => {
    setOccupancyEntries((previous) => {
      const next = updater(previous);
      saveOccupancyEntriesLocal(next);
      return next;
    });
  };

  const upsertRoom = (room: Room) => {
    setRoomsAndPersist((previous) => {
      const exists = previous.some((item) => item.id === room.id);
      return exists ? previous.map((item) => item.id === room.id ? room : item) : [...previous, room];
    });
  };

  const upsertGuest = (guest: Guest) => {
    setGuestsAndPersist((previous) => {
      const exists = previous.some((item) => item.id === guest.id || item.cedula === guest.cedula);
      return exists ? previous.map((item) => (item.id === guest.id || item.cedula === guest.cedula) ? guest : item) : [...previous, guest];
    });
  };

  const upsertReservation = (reservation: Reservation) => {
    setReservationsAndPersist((previous) => {
      const exists = previous.some((item) => item.id === reservation.id);
      return exists ? previous.map((item) => item.id === reservation.id ? reservation : item) : [reservation, ...previous];
    });
  };

  const upsertOccupancyEntry = (entry: OccupancyEntry) => {
    setOccupancyEntriesAndPersist((previous) => {
      const exists = previous.some((item) => item.id === entry.id);
      return exists ? previous.map((item) => item.id === entry.id ? entry : item) : [entry, ...previous];
    });
  };

  // Crea usuario local desde la pantalla Usuarios cuando la API esta apagada.
  const addUser = (u: Omit<AdminUser, 'id' | 'status'>) => {
    const next: AdminUser = { ...u, id: users.length + 1, status: 'Activo' };
    setUsers((p) => { const n = [...p, next]; localStorage.setItem('hotel_users', JSON.stringify(n)); return n; });
  };

  // Edita usuario local desde la pantalla Usuarios cuando la API esta apagada.
  const updateUser = (id: number, user: Omit<AdminUser, 'id' | 'status' | 'password'>) => {
    setUsers((p) => {
      const n = p.map((item) => item.id === id ? { ...item, ...user } : item);
      localStorage.setItem('hotel_users', JSON.stringify(n));
      return n;
    });
  };

  // Activa o desactiva usuarios locales desde la tabla de Usuarios.
  const toggleUserStatus = (id: number) => {
    setUsers((p) => {
      const n = p.map((u): AdminUser => u.id === id ? { ...u, status: u.status === 'Activo' ? 'Inactivo' : 'Activo' } : u);
      localStorage.setItem('hotel_users', JSON.stringify(n));
      return n;
    });
  };

  // Elimina usuario local desde la tabla de Usuarios cuando la API esta apagada.
  const deleteUser = (id: number) => {
    setUsers((p) => { const n = p.filter((u) => u.id !== id); localStorage.setItem('hotel_users', JSON.stringify(n)); return n; });
  };

  // Crea una habitacion en SQL si la API esta activa; si no, usa localStorage.
  const addRoom = async (r: Omit<Room, 'id'>) => {
    if (isApiEnabled()) {
      try {
        const data = await apiSend<RoomResponse>('/api/rooms', 'POST', r);
        upsertRoom(data.room);
        return true;
      } catch (error) {
        alert(`No se pudo crear la habitacion en SQL Server: ${errorMessage(error)}`);
        return false;
      }
    }

    const next: Room = { ...r, id: nextId(rooms) };
    setRoomsAndPersist((previous) => [...previous, next]);
    return true;
  };

  // Cambia estado de una habitacion en SQL si la API esta activa; si no, usa localStorage.
  const updateRoomStatus = async (id: number, status: Room['status'], note?: string) => {
    if (isApiEnabled()) {
      try {
        const data = await apiSend<RoomResponse>(`/api/rooms/${id}/status`, 'PATCH', { status, note });
        upsertRoom(data.room);
        return true;
      } catch (error) {
        alert(`No se pudo actualizar la habitacion en SQL Server: ${errorMessage(error)}`);
        return false;
      }
    }

    setRoomsAndPersist((previous) => previous.map((room) => {
      if (room.id !== id) return room;
      const updated = { ...room, status };
      return note ? { ...updated, note } : updated;
    }));
    return true;
  };

  // Atajo para mandar una habitacion a mantenimiento.
  const setRoomMaintenance = async (id: number, note: string = 'En mantenimiento') => {
    return updateRoomStatus(id, 'Mantenimiento', note);
  };

  // Elimina una habitacion: en SQL queda como borrado logico con auditoria.
  const deleteRoom = async (id: number) => {
    if (isApiEnabled()) {
      try {
        await apiSend('/api/rooms/' + id, 'DELETE', { reason: 'Eliminacion desde pantalla Habitaciones' });
        setRoomsAndPersist((previous) => previous.filter((room) => room.id !== id));
        return true;
      } catch (error) {
        alert(`No se pudo eliminar la habitacion en SQL Server: ${errorMessage(error)}`);
        return false;
      }
    }

    setRoomsAndPersist((previous) => previous.filter((room) => room.id !== id));
    return true;
  };

  // Crea o actualiza un huesped en SQL si la API esta activa; si no, usa localStorage.
  const addGuest = async (g: Omit<Guest, 'id'>) => {
    if (isApiEnabled()) {
      try {
        const data = await apiSend<GuestResponse>('/api/guests', 'POST', g);
        upsertGuest(data.guest);
        return data.guest;
      } catch (error) {
        alert(`No se pudo guardar el huesped en SQL Server: ${errorMessage(error)}`);
        return undefined;
      }
    }

    const existing = guests.find((guest) => guest.cedula === g.cedula);
    const next: Guest = existing ? { ...existing, ...g } : { ...g, id: nextId(guests) };
    upsertGuest(next);
    return next;
  };

  // Busca un huesped por cedula desde el formulario de ocupar habitacion.
  const findGuestByCedula = (cedula: string) => {
    return guests.find((g) => g.cedula === cedula);
  };

  // Ocupa una habitacion, guarda datos del huesped y registra el valor para informes.
  const occupyRoomWithGuest = async (roomId: number, guest: Omit<Guest, 'id'>, price: number, clientType: ClientType) => {
    const room = rooms.find((item) => item.id === roomId);
    if (!room) return false;

    if (isApiEnabled()) {
      try {
        const data = await apiSend<OccupancyResponse>('/api/occupancy', 'POST', { roomId, guest, price, clientType });
        if (data.guest) upsertGuest(data.guest);
        if (data.entry) upsertOccupancyEntry(data.entry);
        if (data.room) upsertRoom(data.room);
        return true;
      } catch (error) {
        alert(`No se pudo registrar la ocupacion en SQL Server: ${errorMessage(error)}`);
        return false;
      }
    }

    const savedGuest = await addGuest(guest);
    if (!savedGuest) return false;

    const note = `Ocupada por ${guest.nombres} ${guest.apellidos} - ${clientType} - Valor: $${price}`;
    await updateRoomStatus(roomId, 'Ocupada', note);

    const entry: OccupancyEntry = {
      id: nextId(occupancyEntries),
      roomId,
      roomNumber: room.number,
      guestName: `${guest.nombres} ${guest.apellidos}`,
      price,
      clientType,
      date: currentDate(),
      status: 'Activa'
    };
    upsertOccupancyEntry(entry);
    return true;
  };

  // Cancela una entrada activa, libera la habitacion y deja motivo para reportes.
  const cancelRoomOccupancy = async (roomId: number, reason: string) => {
    if (isApiEnabled()) {
      try {
        const data = await apiSend<OccupancyResponse>(`/api/occupancy/room/${roomId}/cancel`, 'PATCH', { reason });
        if (data.entry) upsertOccupancyEntry(data.entry);
        if (data.room) upsertRoom(data.room);
        return true;
      } catch (error) {
        alert(`No se pudo cancelar la ocupacion en SQL Server: ${errorMessage(error)}`);
        return false;
      }
    }

    setOccupancyEntriesAndPersist((previous) => {
      let canceled = false;
      return previous.map((entry) => {
        if (!canceled && entry.roomId === roomId && entry.status === 'Activa') {
          canceled = true;
          return { ...entry, status: 'Cancelada' as const, cancellationReason: reason, canceledAt: currentDate() };
        }
        return entry;
      });
    });

    await updateRoomStatus(roomId, 'Disponible', `Entrada cancelada: ${reason}`);
    return true;
  };

  // Actualiza la nota interna de una habitacion.
  const updateRoomNote = async (id: number, note: string) => {
    const existing = rooms.find((room) => room.id === id);
    if (!existing) return false;

    if (isApiEnabled()) {
      try {
        const data = await apiSend<RoomResponse>(`/api/rooms/${id}`, 'PUT', { ...existing, note, reason: 'Actualizacion de nota' });
        upsertRoom(data.room);
        return true;
      } catch (error) {
        alert(`No se pudo actualizar la nota en SQL Server: ${errorMessage(error)}`);
        return false;
      }
    }

    setRoomsAndPersist((previous) => previous.map((room) => room.id === id ? { ...room, note } : room));
    return true;
  };

  // Crea una reserva en SQL si la API esta activa; si no, usa localStorage.
  const addReservation = async (r: Omit<Reservation, 'id'>) => {
    if (isApiEnabled()) {
      try {
        const data = await apiSend<ReservationResponse>('/api/reservations', 'POST', r);
        upsertReservation(data.reservation);
        return true;
      } catch (error) {
        alert(`No se pudo crear la reservacion en SQL Server: ${errorMessage(error)}`);
        return false;
      }
    }

    const next: Reservation = { ...r, id: nextId(reservations) };
    setReservationsAndPersist((previous) => [next, ...previous]);
    return true;
  };

  // Elimina una reserva desde la tabla de Reservaciones.
  const deleteReservation = async (id: number) => {
    if (isApiEnabled()) {
      try {
        await apiSend('/api/reservations/' + id, 'DELETE', { reason: 'Eliminacion desde pantalla Reservaciones' });
        setReservationsAndPersist((previous) => previous.filter((reservation) => reservation.id !== id));
        return true;
      } catch (error) {
        alert(`No se pudo eliminar la reservacion en SQL Server: ${errorMessage(error)}`);
        return false;
      }
    }

    setReservationsAndPersist((previous) => previous.filter((reservation) => reservation.id !== id));
    return true;
  };

  // Procesa una reserva desde el Dashboard: confirmar llegada o cancelar.
  const updateReservationStatus = async (id: number, status: Reservation['status'], reason?: string) => {
    const existing = reservations.find((reservation) => reservation.id === id);
    if (!existing) return false;

    if (isApiEnabled()) {
      try {
        const data = await apiSend<ReservationStatusResponse>(`/api/reservations/${id}/status`, 'PATCH', { status, reason });
        setReservationsAndPersist((previous) => previous.filter((reservation) => reservation.id !== id));
        if (data.room) upsertRoom(data.room);
        if (data.entry) upsertOccupancyEntry(data.entry);
        return true;
      } catch (error) {
        alert(`No se pudo procesar la reservacion en SQL Server: ${errorMessage(error)}`);
        return false;
      }
    }

    const room = rooms.find((item) => item.number === existing.room);
    if (room && status === 'Cancelada') {
      await updateRoomStatus(room.id, 'Disponible', reason ?? room.note);
    } else if (room && status === 'Confirmada') {
      await updateRoomStatus(room.id, 'Ocupada', `Ocupada por ${existing.guest} - ${existing.clientType ?? 'Persona comun'} - Valor: $${existing.price ?? 0}`);
      const entry: OccupancyEntry = {
        id: nextId(occupancyEntries),
        roomId: room.id,
        roomNumber: room.number,
        guestName: existing.guest,
        price: existing.price ?? 0,
        clientType: existing.clientType ?? 'Persona comun',
        date: currentDate(),
        status: 'Activa'
      };
      upsertOccupancyEntry(entry);
    }

    setReservationsAndPersist((previous) => previous.filter((reservation) => reservation.id !== id));
    return true;
  };

  return (
    <DataContext.Provider value={{ rooms, users, reservations, guests, occupancyEntries, addUser, updateUser, toggleUserStatus, deleteUser, addRoom, updateRoomStatus, setRoomMaintenance, deleteRoom, addGuest, findGuestByCedula, occupyRoomWithGuest, cancelRoomOccupancy, addReservation, updateReservationStatus, updateRoomNote, deleteReservation }}>
      {children}
    </DataContext.Provider>
  );
};

// Hook obligatorio para leer o modificar datos del hotel desde cualquier pantalla.
export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
};

export default DataContext;