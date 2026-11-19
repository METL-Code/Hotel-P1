// Configuracion principal de rutas del frontend.
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
import { AdminAudit } from './pages/admin/AdminAudit';
import { WorkerLayout } from './pages/worker/WorkerLayout';
import './App.css';

function App() {
  return (
    <Router>
      <DataProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LoginPage />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="usuarios" element={<AdminUsers />} />
              <Route path="habitaciones" element={<AdminRooms />} />
              <Route path="reservaciones" element={<AdminReservations />} />
              <Route path="reportes" element={<AdminReports />} />
              <Route path="informe-diario" element={<AdminDailyReport />} />
              <Route path="informe-mensual" element={<AdminMonthlyReport />} />
              <Route path="auditoria" element={<AdminAudit />} />
              <Route path="configuracion" element={<AdminSettings />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Route>

            <Route
              path="/trabajador"
              element={
                <ProtectedRoute requiredRole="trabajador">
                  <WorkerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="reservaciones" element={<AdminReservations />} />
              <Route path="configuracion" element={<AdminSettings />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </DataProvider>
    </Router>
  );
}

export default App;
