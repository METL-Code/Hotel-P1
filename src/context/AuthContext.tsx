import React, { createContext, useContext, useState, ReactNode } from 'react';
import { apiSend } from '../services/api';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'trabajador';
}

interface LoginResponse {
  user: User;
}

interface StoredAdminUser {
  id: number;
  username: string;
  email: string;
  password?: string;
  role: 'admin' | 'trabajador';
  status: 'Activo' | 'Inactivo';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string, role: 'admin' | 'trabajador') => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('hotel_user');
    return storedUser ? (JSON.parse(storedUser) as User) : null;
  });

  const saveUser = (nextUser: User | null) => {
    if (nextUser) {
      localStorage.setItem('hotel_user', JSON.stringify(nextUser));
    } else {
      localStorage.removeItem('hotel_user');
    }
    setUser(nextUser);
  };

  const login = async (username: string, password: string, role: 'admin' | 'trabajador') => {
    if (!username || !password) {
      throw new Error('Usuario y contrasena son requeridos');
    }

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
        message.includes('Error en el backend');

      if (shouldUseLocalFallback) {
        console.warn('Backend no disponible o SQL Server sin conexion. Usando login local temporal.');
      } else {
        throw error;
      }
    }

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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};
