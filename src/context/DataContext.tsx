// Contexto global de datos del hotel.
// Toda la informacion proviene de SQL Server y cada cambio se guarda en SQL Server a traves de backend/server.js.
import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { apiGet, apiSend } from '../services/api';
import { getErrorMessage } from '../utils/format';

export interface Room {
  id: number;
  number: string;
  type: string;
  status: 'Disponible' | 'Ocupada' | 'Mantenimiento';
  note?: string;
}

export type ClientType = 'Persona comun' | 'Persona recurrente';

export interface AdminUser {
  id: number;
  nombres: string;
  apellidos: string;
  username: string;
  email: string;
  role: 'admin' | 'trabajador';
  status: 'Activo' | 'Inactivo';
}

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

export interface Guest {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  email?: string;
}

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

interface DataContextType {
  rooms: Room[];
  reservations: Reservation[];
  guests: Guest[];
  occupancyEntries: OccupancyEntry[];
  loading: boolean;
  error: string | null;
  clearError: () => void;
  refreshData: () => Promise<void>;
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

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [occupancyEntries, setOccupancyEntries] = useState<OccupancyEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const refreshData = useCallback(async () => {
    const token = localStorage.getItem('hotel_token');
    if (!token) {
      setRooms([]);
      setGuests([]);
      setReservations([]);
      setOccupancyEntries([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [roomsData, guestsData, reservationsData, occupancyData] = await Promise.all([
        apiGet<RoomsResponse>('/api/rooms'),
        apiGet<GuestsResponse>('/api/guests'),
        apiGet<ReservationsResponse>('/api/reservations'),
        apiGet<OccupancyEntriesResponse>('/api/occupancy')
      ]);
      setRooms(roomsData.rooms);
      setGuests(guestsData.guests);
      setReservations(reservationsData.reservations);
      setOccupancyEntries(occupancyData.occupancyEntries);
    } catch (err) {
      setError(`No se pudieron cargar los datos desde SQL Server: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const handleAuthChange = () => {
      refreshData();
    };
    window.addEventListener('hotel-auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('hotel-auth-change', handleAuthChange);
    };
  }, [refreshData]);

  const upsertRoom = (room: Room) => {
    setRooms((previous) => {
      const exists = previous.some((item) => item.id === room.id);
      return exists ? previous.map((item) => item.id === room.id ? room : item) : [...previous, room];
    });
  };

  const upsertGuest = (guest: Guest) => {
    setGuests((previous) => {
      const exists = previous.some((item) => item.id === guest.id || item.cedula === guest.cedula);
      return exists
        ? previous.map((item) => (item.id === guest.id || item.cedula === guest.cedula) ? guest : item)
        : [...previous, guest];
    });
  };

  const upsertReservation = (reservation: Reservation) => {
    setReservations((previous) => {
      const exists = previous.some((item) => item.id === reservation.id);
      return exists
        ? previous.map((item) => item.id === reservation.id ? reservation : item)
        : [reservation, ...previous];
    });
  };

  const upsertOccupancyEntry = (entry: OccupancyEntry) => {
    setOccupancyEntries((previous) => {
      const exists = previous.some((item) => item.id === entry.id);
      return exists
        ? previous.map((item) => item.id === entry.id ? entry : item)
        : [entry, ...previous];
    });
  };

  const addRoom = async (r: Omit<Room, 'id'>) => {
    setError(null);
    try {
      const data = await apiSend<RoomResponse>('/api/rooms', 'POST', r);
      upsertRoom(data.room);
      return true;
    } catch (err) {
      setError(`No se pudo crear la habitacion: ${getErrorMessage(err)}`);
      return false;
    }
  };

  const updateRoomStatus = async (id: number, status: Room['status'], note?: string) => {
    setError(null);
    try {
      const data = await apiSend<RoomResponse>(`/api/rooms/${id}/status`, 'PATCH', { status, note });
      upsertRoom(data.room);
      return true;
    } catch (err) {
      setError(`No se pudo actualizar la habitacion: ${getErrorMessage(err)}`);
      return false;
    }
  };

  const setRoomMaintenance = async (id: number, note: string = 'En mantenimiento') => {
    return updateRoomStatus(id, 'Mantenimiento', note);
  };

  const deleteRoom = async (id: number) => {
    setError(null);
    try {
      await apiSend(`/api/rooms/${id}`, 'DELETE', { reason: 'Eliminacion desde pantalla Habitaciones' });
      setRooms((previous) => previous.filter((room) => room.id !== id));
      return true;
    } catch (err) {
      setError(`No se pudo eliminar la habitacion: ${getErrorMessage(err)}`);
      return false;
    }
  };

  const addGuest = async (g: Omit<Guest, 'id'>) => {
    setError(null);
    try {
      const data = await apiSend<GuestResponse>('/api/guests', 'POST', g);
      upsertGuest(data.guest);
      return data.guest;
    } catch (err) {
      setError(`No se pudo guardar el huesped: ${getErrorMessage(err)}`);
      return undefined;
    }
  };

  const findGuestByCedula = (cedula: string) => {
    return guests.find((g) => g.cedula === cedula);
  };

  const occupyRoomWithGuest = async (roomId: number, guest: Omit<Guest, 'id'>, price: number, clientType: ClientType) => {
    setError(null);
    try {
      const data = await apiSend<OccupancyResponse>('/api/occupancy', 'POST', { roomId, guest, price, clientType });
      if (data.guest) upsertGuest(data.guest);
      if (data.entry) upsertOccupancyEntry(data.entry);
      if (data.room) upsertRoom(data.room);
      return true;
    } catch (err) {
      setError(`No se pudo registrar la ocupacion: ${getErrorMessage(err)}`);
      return false;
    }
  };

  const cancelRoomOccupancy = async (roomId: number, reason: string) => {
    setError(null);
    try {
      const data = await apiSend<OccupancyResponse>(`/api/occupancy/room/${roomId}/cancel`, 'PATCH', { reason });
      if (data.entry) upsertOccupancyEntry(data.entry);
      if (data.room) upsertRoom(data.room);
      return true;
    } catch (err) {
      setError(`No se pudo cancelar la ocupacion: ${getErrorMessage(err)}`);
      return false;
    }
  };

  const updateRoomNote = async (id: number, note: string) => {
    const existing = rooms.find((room) => room.id === id);
    if (!existing) return false;
    setError(null);

    try {
      const data = await apiSend<RoomResponse>(`/api/rooms/${id}`, 'PUT', { ...existing, note, reason: 'Actualizacion de nota' });
      upsertRoom(data.room);
      return true;
    } catch (err) {
      setError(`No se pudo actualizar la nota: ${getErrorMessage(err)}`);
      return false;
    }
  };

  const addReservation = async (r: Omit<Reservation, 'id'>) => {
    setError(null);
    try {
      const data = await apiSend<ReservationResponse>('/api/reservations', 'POST', r);
      upsertReservation(data.reservation);
      return true;
    } catch (err) {
      setError(`No se pudo crear la reservacion: ${getErrorMessage(err)}`);
      return false;
    }
  };

  const deleteReservation = async (id: number) => {
    setError(null);
    try {
      await apiSend(`/api/reservations/${id}`, 'DELETE', { reason: 'Eliminacion desde pantalla Reservaciones' });
      setReservations((previous) => previous.filter((reservation) => reservation.id !== id));
      return true;
    } catch (err) {
      setError(`No se pudo eliminar la reservacion: ${getErrorMessage(err)}`);
      return false;
    }
  };

  const updateReservationStatus = async (id: number, status: Reservation['status'], reason?: string) => {
    setError(null);
    try {
      const data = await apiSend<ReservationStatusResponse>(`/api/reservations/${id}/status`, 'PATCH', { status, reason });
      if (status === 'Pendiente') {
        upsertReservation(data.reservation);
      } else {
        setReservations((previous) => previous.filter((reservation) => reservation.id !== id));
      }
      if (data.room) upsertRoom(data.room);
      if (data.entry) upsertOccupancyEntry(data.entry);
      return true;
    } catch (err) {
      setError(`No se pudo procesar la reservacion: ${getErrorMessage(err)}`);
      return false;
    }
  };

  return (
    <DataContext.Provider value={{
      rooms,
      reservations,
      guests,
      occupancyEntries,
      loading,
      error,
      clearError,
      refreshData,
      addRoom,
      updateRoomStatus,
      setRoomMaintenance,
      deleteRoom,
      addGuest,
      findGuestByCedula,
      occupyRoomWithGuest,
      cancelRoomOccupancy,
      addReservation,
      updateReservationStatus,
      updateRoomNote,
      deleteReservation
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
};

export default DataContext;
