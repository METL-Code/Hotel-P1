// Configuracion principal de rutas del frontend.
// Aqui se decide que pantalla se ve segun la URL del navegador.
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { LoginPage } from './pages/LoginPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminRooms } from './pages/admin/AdminRooms';
import { AdminReservations } from './pages/admin/AdminReservations';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminReports } from './pages/admin/AdminReports';
import { AdminDailyReport } from './pages/admin/AdminDailyReport';
import { AdminMonthlyReport } from './pages/admin/AdminMonthlyReport';
import { WorkerLayout } from './pages/worker/WorkerLayout';
import './App.css';

function App() {
  return (
    <Router>
      {/* DataProvider guarda y comparte habitaciones, reservas, usuarios y reportes. */}
      <DataProvider>
        {/* AuthProvider guarda y comparte el usuario logueado. */}
        <AuthProvider>
          <Routes>
            {/* Login inicial. Es lo primero que se ve en / . */}
            <Route path="/" element={<LoginPage />} />

            {/* Rutas privadas del administrador. Solo entran usuarios con role admin. */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              {/* Si el usuario visita /admin, lo enviamos automaticamente al dashboard. */}
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="usuarios" element={<AdminUsers />} />
              <Route path="habitaciones" element={<AdminRooms />} />
              <Route path="reservaciones" element={<AdminReservations />} />
              <Route path="reportes" element={<AdminReports />} />
              <Route path="informe-diario" element={<AdminDailyReport />} />
              <Route path="informe-mensual" element={<AdminMonthlyReport />} />
              <Route path="configuracion" element={<AdminSettings />} />
            </Route>

            {/* Rutas privadas del trabajador/usuario operativo. */}
            <Route
              path="/trabajador"
              element={
                <ProtectedRoute requiredRole="trabajador">
                  <WorkerLayout />
                </ProtectedRoute>
              }
            >
              {/* Si el trabajador visita /trabajador, lo enviamos al dashboard. */}
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="reservaciones" element={<AdminReservations />} />
              <Route path="reportes" element={<AdminReports />} />
              <Route path="configuracion" element={<AdminSettings />} />
            </Route>

            {/* Cualquier URL desconocida vuelve al login. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </DataProvider>
    </Router>
  );
}

export default App;