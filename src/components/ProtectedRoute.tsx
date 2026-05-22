// Componente de seguridad para rutas privadas.
// Se usa en App.tsx para impedir que entren usuarios no logueados o con rol incorrecto.
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// children es la pantalla que queremos proteger.
// requiredRole indica si la ruta necesita admin o trabajador.
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'trabajador';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole
}) => {
  // Leemos el usuario actual desde AuthContext.
  const { isAuthenticated, user } = useAuth();

  // Si no hay sesion, el usuario vuelve al login.
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Si hay sesion pero el rol no coincide, tambien vuelve al login.
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  // Si pasa las validaciones, se muestra la pantalla solicitada.
  return <>{children}</>;
};