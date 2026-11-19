// Contexto global de autenticacion.
// Valida las credenciales exclusivamente contra SQL Server a traves de backend/server.js.
import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { apiGet, apiSend } from '../services/api';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'trabajador';
}

interface LoginResponse {
  token: string;
  user: User;
}

interface MeResponse {
  user: User;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string, role: 'admin' | 'trabajador') => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const clearLegacyLocalCache = () => {
  for (const key of ['hotel_rooms', 'hotel_users', 'hotel_guests', 'hotel_reservations', 'hotel_occupancy_entries']) {
    localStorage.removeItem(key);
  }
};

const readStoredUser = (): User | null => {
  const storedUser = localStorage.getItem('hotel_user');
  const storedToken = localStorage.getItem('hotel_token');
  if (!storedUser || !storedToken) {
    localStorage.removeItem('hotel_user');
    localStorage.removeItem('hotel_token');
    return null;
  }
  try {
    const parsed = JSON.parse(storedUser) as Partial<User>;
    if (!parsed?.id || !parsed?.username || (parsed.role !== 'admin' && parsed.role !== 'trabajador')) {
      localStorage.removeItem('hotel_user');
      localStorage.removeItem('hotel_token');
      return null;
    }
    return parsed as User;
  } catch {
    localStorage.removeItem('hotel_user');
    localStorage.removeItem('hotel_token');
    return null;
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    clearLegacyLocalCache();
    return readStoredUser();
  });

  const saveSession = useCallback((nextUser: User | null, token?: string) => {
    if (nextUser && token) {
      localStorage.setItem('hotel_user', JSON.stringify(nextUser));
      localStorage.setItem('hotel_token', token);
    } else if (nextUser) {
      localStorage.setItem('hotel_user', JSON.stringify(nextUser));
    } else {
      localStorage.removeItem('hotel_user');
      localStorage.removeItem('hotel_token');
    }
    setUser(nextUser);
    window.dispatchEvent(new Event('hotel-auth-change'));
  }, []);

  // Verifica la sesion contra SQL Server al cargar y reacciona si expira (HTTP 401).
  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      window.dispatchEvent(new Event('hotel-auth-change'));
    };
    window.addEventListener('hotel-auth-expired', handleExpired);

    const token = localStorage.getItem('hotel_token');
    let active = true;
    if (token) {
      apiGet<MeResponse>('/api/auth/me')
        .then((data) => {
          if (active) saveSession(data.user);
        })
        .catch(() => {
          if (active) saveSession(null);
        });
    }

    return () => {
      active = false;
      window.removeEventListener('hotel-auth-expired', handleExpired);
    };
  }, [saveSession]);

  const login = async (username: string, password: string, role: 'admin' | 'trabajador') => {
    if (!username.trim() || !password) {
      throw new Error('Usuario y contrasena son requeridos');
    }

    const data = await apiSend<LoginResponse>('/api/auth/login', 'POST', {
      username: username.trim(),
      password,
      role
    });
    saveSession(data.user, data.token);
  };

  const logout = useCallback(() => {
    saveSession(null);
  }, [saveSession]);

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
