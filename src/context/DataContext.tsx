import React, { createContext, useContext, useState, ReactNode } from 'react';

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
  password: string;
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
  addRoom: (r: Omit<Room, 'id'>) => void;
  updateRoomStatus: (id: number, status: Room['status'], note?: string) => void;
  setRoomMaintenance: (id: number, note?: string) => void;
  deleteRoom: (id: number) => void;
  addGuest: (g: Omit<Guest, 'id'>) => Guest;
  findGuestByCedula: (cedula: string) => Guest | undefined;
  occupyRoomWithGuest: (roomId: number, guest: Omit<Guest, 'id'>, price: number, clientType: ClientType) => void;
  cancelRoomOccupancy: (roomId: number, reason: string) => void;
  addReservation: (r: Omit<Reservation, 'id'>) => void;
  updateReservationStatus: (id: number, status: Reservation['status'], reason?: string) => void;
  updateRoomNote: (id: number, note: string) => void;
  deleteReservation: (id: number) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const initialRooms: Room[] = [
  { id: 1, number: '101', type: 'Doble', status: 'Disponible' },
  { id: 2, number: '102', type: 'Suite', status: 'Ocupada' },
  { id: 3, number: '103', type: 'Individual', status: 'Disponible' },
  { id: 4, number: '104', type: 'Doble', status: 'Mantenimiento' }
];

const initialUsers: AdminUser[] = [
  { id: 1, nombres: 'Administrador', apellidos: 'Principal', username: 'admin', email: 'admin@hotel.com', password: 'admin123', role: 'admin', status: 'Activo' },
  { id: 2, nombres: 'Mariana', apellidos: 'Lopez', username: 'mariana', email: 'mariana@hotel.com', password: 'trabajador123', role: 'trabajador', status: 'Activo' },
  { id: 3, nombres: 'Carlos', apellidos: 'Perez', username: 'carlos', email: 'carlos@hotel.com', password: 'trabajador123', role: 'trabajador', status: 'Inactivo' }
];

const initialReservations: Reservation[] = [
  { id: 1, guest: 'Luis Fernández', room: '101', status: 'Confirmada', checkin: '2026-06-01', checkout: '2026-06-05' },
  { id: 2, guest: 'Ana Gómez', room: '102', status: 'Pendiente', checkin: '2026-06-04', checkout: '2026-06-06' },
  { id: 3, guest: 'Mario López', room: '103', status: 'Cancelada', checkin: '2026-06-10', checkout: '2026-06-12' }
];

const currentDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const nextId = (items: { id: number }[]) => items.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rooms, setRooms] = useState<Room[]>(() => {
    try {
      const s = localStorage.getItem('hotel_rooms');
      return s ? JSON.parse(s) : initialRooms;
    } catch {
      return initialRooms;
    }
  });

  const [users, setUsers] = useState<AdminUser[]>(() => {
    try {
      const s = localStorage.getItem('hotel_users');
      if (!s) return initialUsers;
      const parsed = JSON.parse(s) as Partial<AdminUser>[];
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
    } catch {
      return initialUsers;
    }
  });

  const [guests, setGuests] = useState<Guest[]>(() => {
    try {
      const s = localStorage.getItem('hotel_guests');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const [reservations, setReservations] = useState<Reservation[]>(() => {
    try {
      const s = localStorage.getItem('hotel_reservations');
      return s ? JSON.parse(s) : initialReservations;
    } catch {
      return initialReservations;
    }
  });

  const [occupancyEntries, setOccupancyEntries] = useState<OccupancyEntry[]>(() => {
    try {
      const s = localStorage.getItem('hotel_occupancy_entries');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const addUser = (u: Omit<AdminUser, 'id' | 'status'>) => {
    const next: AdminUser = { ...u, id: users.length + 1, status: 'Activo' };
    setUsers((p) => { const n = [...p, next]; localStorage.setItem('hotel_users', JSON.stringify(n)); return n; });
  };

  const updateUser = (id: number, user: Omit<AdminUser, 'id' | 'status' | 'password'>) => {
    setUsers((p) => {
      const n = p.map((item) => item.id === id ? { ...item, ...user } : item);
      localStorage.setItem('hotel_users', JSON.stringify(n));
      return n;
    });
  };

  const toggleUserStatus = (id: number) => {
    setUsers((p) => {
      const n = p.map((u): AdminUser => u.id === id ? { ...u, status: u.status === 'Activo' ? 'Inactivo' : 'Activo' } : u);
      localStorage.setItem('hotel_users', JSON.stringify(n));
      return n;
    });
  };

  const deleteUser = (id: number) => {
    setUsers((p) => { const n = p.filter((u) => u.id !== id); localStorage.setItem('hotel_users', JSON.stringify(n)); return n; });
  };

  const addRoom = (r: Omit<Room, 'id'>) => {
    setRooms((p) => {
      const nextId = p.reduce((maxId, room) => Math.max(maxId, room.id), 0) + 1;
      const next: Room = { ...r, id: nextId };
      const n = [...p, next];
      localStorage.setItem('hotel_rooms', JSON.stringify(n));
      return n;
    });
  };

  const addGuest = (g: Omit<Guest, 'id'>) => {
    const next: Guest = { ...g, id: guests.length + 1 };
    setGuests((p) => { const n = [...p, next]; localStorage.setItem('hotel_guests', JSON.stringify(n)); return n; });
    return next;
  };

  const findGuestByCedula = (cedula: string) => {
    return guests.find((g) => g.cedula === cedula);
  };

  const occupyRoomWithGuest = (roomId: number, guest: Omit<Guest, 'id'>, price: number, clientType: ClientType) => {
    const room = rooms.find((item) => item.id === roomId);
    if (!room) return;

    // Ensure guest exists (create if necessary)
    let found = guests.find((g) => g.cedula === guest.cedula);
    if (!found) {
      const next: Guest = { ...guest, id: guests.length + 1 };
      setGuests((p) => { const n = [...p, next]; localStorage.setItem('hotel_guests', JSON.stringify(n)); return n; });
      found = next;
    }

    // Update room to Ocupada and add note with guest name
    setRooms((p) => {
      const n = p.map((r): Room => r.id === roomId ? { ...r, status: 'Ocupada', note: `Ocupada por ${guest.nombres} ${guest.apellidos} - ${clientType} - Valor: $${price}` } : r);
      localStorage.setItem('hotel_rooms', JSON.stringify(n));
      return n;
    });

    setOccupancyEntries((p) => {
      const entry: OccupancyEntry = {
        id: nextId(p),
        roomId,
        roomNumber: room.number,
        guestName: `${guest.nombres} ${guest.apellidos}`,
        price,
        clientType,
        date: currentDate(),
        status: 'Activa'
      };
      const n = [entry, ...p];
      localStorage.setItem('hotel_occupancy_entries', JSON.stringify(n));
      return n;
    });
  };

  const cancelRoomOccupancy = (roomId: number, reason: string) => {
    setOccupancyEntries((p) => {
      let canceled = false;
      const n = p.map((entry) => {
        if (!canceled && entry.roomId === roomId && entry.status === 'Activa') {
          canceled = true;
          return {
            ...entry,
            status: 'Cancelada' as const,
            cancellationReason: reason,
            canceledAt: currentDate()
          };
        }
        return entry;
      });
      localStorage.setItem('hotel_occupancy_entries', JSON.stringify(n));
      return n;
    });

    setRooms((p) => {
      const n = p.map((r) => r.id === roomId ? { ...r, status: 'Disponible' as const, note: `Entrada cancelada: ${reason}` } : r);
      localStorage.setItem('hotel_rooms', JSON.stringify(n));
      return n;
    });
  };

  const updateRoomStatus = (id: number, status: Room['status'], note?: string) => {
    setRooms((p) => {
      const n = p.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, status };
        if (note) {
          return { ...updated, note };
        }
        return updated;
      });
      localStorage.setItem('hotel_rooms', JSON.stringify(n));
      return n;
    });
  };

  const setRoomMaintenance = (id: number, note: string = 'En mantenimiento') => {
    setRooms((p) => {
      const n = p.map((r): Room => r.id === id ? { ...r, status: 'Mantenimiento', note } : r);
      localStorage.setItem('hotel_rooms', JSON.stringify(n));
      return n;
    });
  };

  const deleteRoom = (id: number) => {
    setRooms((p) => { const n = p.filter((r) => r.id !== id); localStorage.setItem('hotel_rooms', JSON.stringify(n)); return n; });
  };

  const updateRoomNote = (id: number, note: string) => {
    setRooms((p) => { const n = p.map((r) => r.id === id ? { ...r, note } : r); localStorage.setItem('hotel_rooms', JSON.stringify(n)); return n; });
  };

  const addReservation = (r: Omit<Reservation, 'id'>) => {
    const next: Reservation = { ...r, id: reservations.length + 1 };
    setReservations((p) => { const n = [next, ...p]; localStorage.setItem('hotel_reservations', JSON.stringify(n)); return n; });
  };

  const deleteReservation = (id: number) => {
    setReservations((p) => { const n = p.filter((r) => r.id !== id); localStorage.setItem('hotel_reservations', JSON.stringify(n)); return n; });
  };

  const updateReservationStatus = (id: number, status: Reservation['status'], reason?: string) => {
    setReservations((p) => {
      const existing = p.find((r) => r.id === id);
      if (!existing) return p;

      const roomNumber = existing.room;

      // Update room status and note depending on reservation result
      if (status === 'Cancelada') {
        // set room to Disponible and add cancellation note
        setRooms((roomsPrev) => {
          const updated = roomsPrev.map((rm): Room => (rm.number === roomNumber ? { ...rm, status: 'Disponible', note: reason ?? rm.note } : rm));
          localStorage.setItem('hotel_rooms', JSON.stringify(updated));
          return updated;
        });
      } else if (status === 'Confirmada') {
        // set room to Ocupada and add note with guest
        setRooms((roomsPrev) => {
          const updated = roomsPrev.map((rm): Room => (rm.number === roomNumber ? { ...rm, status: 'Ocupada', note: `Ocupada por ${existing.guest} - ${existing.clientType ?? 'Persona comun'} - Valor: $${existing.price ?? 0}` } : rm));
          localStorage.setItem('hotel_rooms', JSON.stringify(updated));
          return updated;
        });

        const room = rooms.find((rm) => rm.number === roomNumber);
        if (room) {
          setOccupancyEntries((entriesPrev) => {
            const entry: OccupancyEntry = {
              id: nextId(entriesPrev),
              roomId: room.id,
              roomNumber,
              guestName: existing.guest,
              price: existing.price ?? 0,
              clientType: existing.clientType ?? 'Persona comun',
              date: currentDate(),
              status: 'Activa'
            };
            const updated = [entry, ...entriesPrev];
            localStorage.setItem('hotel_occupancy_entries', JSON.stringify(updated));
            return updated;
          });
        }
      }

      // Remove the reservation from the list after processing
      const n = p.filter((r) => r.id !== id);
      localStorage.setItem('hotel_reservations', JSON.stringify(n));
      return n;
    });
  };

  return (
    <DataContext.Provider value={{ rooms, users, reservations, guests, occupancyEntries, addUser, updateUser, toggleUserStatus, deleteUser, addRoom, updateRoomStatus, setRoomMaintenance, deleteRoom, addGuest, findGuestByCedula, occupyRoomWithGuest, cancelRoomOccupancy, addReservation, updateReservationStatus, updateRoomNote, deleteReservation }}>
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
