// Contexto global de autenticacion.
// Aqui se guarda quien inicio sesion y se decide si entra como admin o trabajador.
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { apiSend, isApiEnabled } from '../services/api';

// Usuario minimo que necesita el frontend para proteger rutas y mostrar informacion.
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'trabajador';
}

// Forma esperada de la respuesta del backend cuando el login es exitoso.
interface LoginResponse {
  user: User;
}

// Usuario guardado en localStorage cuando se trabaja sin SQL Server.
interface StoredAdminUser {
  id: number;
  username: string;
  email: string;
  password?: string;
  role: 'admin' | 'trabajador';
  status: 'Activo' | 'Inactivo';
}

// Contrato de funciones y datos que cualquier pantalla puede usar desde useAuth().
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string, role: 'admin' | 'trabajador') => Promise<void>;
  logout: () => void;
}

// Contexto React; empieza vacio y se llena dentro de AuthProvider.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider que envuelve toda la app desde App.tsx.
// Aqui vive el estado de sesion que se ve en layouts y rutas protegidas.
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Lee la sesion guardada para que al recargar no se pierda el login.
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('hotel_user');
    return storedUser ? (JSON.parse(storedUser) as User) : null;
  });

  // Guarda o borra el usuario actual en localStorage y en el estado de React.
  const saveUser = (nextUser: User | null) => {
    if (nextUser) {
      localStorage.setItem('hotel_user', JSON.stringify(nextUser));
    } else {
      localStorage.removeItem('hotel_user');
    }
    setUser(nextUser);
  };

  // Flujo de inicio de sesion usado por LoginPage.
  // Primero intenta API si esta activada; si falla por conexion usa modo local.
  const login = async (username: string, password: string, role: 'admin' | 'trabajador') => {
    if (!username || !password) {
      throw new Error('Usuario y contrasena son requeridos');
    }

    // Si VITE_API_ENABLED=true, se intenta validar contra backend/server.js.
    if (isApiEnabled()) {
      try {
        const data = await apiSend<LoginResponse>('/api/auth/login', 'POST', { username, password, role });
        saveUser(data.user);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        const shouldUseLocalFallback =
          error instanceof TypeError ||
          message.includes('Server is not found') ||
          message.includes('SQL Server') ||
          message.includes('Error interno') ||
          message.includes('Failed to fetch') ||
          message.includes('La API no respondio a tiempo') ||
          message.includes('Respuesta invalida') ||
          message.includes('Error en el backend');

        if (shouldUseLocalFallback) {
          console.warn('Backend no disponible o SQL Server sin conexion. Usando login local temporal.');
        } else {
          throw error;
        }
      }
    }

    // Fallback local: busca usuarios creados desde la app en localStorage.
    const storedUsers = localStorage.getItem('hotel_users');
    const users = storedUsers ? (JSON.parse(storedUsers) as StoredAdminUser[]) : [];
    const foundUser = users.find((item) =>
      item.username.toLowerCase() === username.trim().toLowerCase() &&
      item.role === role
    );

    if (foundUser) {
      if (foundUser.status !== 'Activo') {
        throw new Error('Este usuario esta inactivo');
      }

      if (foundUser.password !== password) {
        throw new Error('Usuario o contrasena incorrectos');
      }

      saveUser({
        id: String(foundUser.id),
        username: foundUser.username,
        email: foundUser.email,
        role: foundUser.role
      });
      return;
    }

    // Usuarios de emergencia para desarrollo local cuando no hay backend o SQL Server.
    if (role === 'admin' && password === 'admin123') {
      saveUser({
        id: '1',
        username,
        email: `${username}@hotel.com`,
        role: 'admin'
      });
    } else if (role === 'trabajador' && password === 'trabajador123') {
      saveUser({
        id: '2',
        username,
        email: `${username}@hotel.com`,
        role: 'trabajador'
      });
    } else {
      throw new Error('Usuario o contrasena incorrectos');
    }
  };

  // Cierra sesion y devuelve la app al estado sin usuario.
  const logout = () => {
    saveUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook usado por pantallas y rutas para leer login, usuario y logout.
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};
