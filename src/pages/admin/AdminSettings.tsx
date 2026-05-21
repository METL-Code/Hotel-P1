import React, { useState } from 'react';

export const AdminSettings: React.FC = () => {
  const [notifications, setNotifications] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [alertLowStock, setAlertLowStock] = useState(true);

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>Configuración</h2>
        <p>Ajusta las opciones principales del sistema de gestión hotelera.</p>
      </div>

      <div className="admin-card settings-card">
        <h3>Preferencias del sistema</h3>
        <label className="setting-row">
          <div>
            <strong>Notificaciones activas</strong>
            <p>Enviar alertas sobre nuevos registros y cambios.</p>
          </div>
          <input type="checkbox" checked={notifications} onChange={() => setNotifications(!notifications)} />
        </label>

        <label className="setting-row">
          <div>
            <strong>Modo mantenimiento</strong>
            <p>Deshabilita algunas funciones temporales.</p>
          </div>
          <input type="checkbox" checked={maintenanceMode} onChange={() => setMaintenanceMode(!maintenanceMode)} />
        </label>

        <label className="setting-row">
          <div>
            <strong>Alertas de stock</strong>
            <p>Recibir aviso cuando los suministros estén bajos.</p>
          </div>
          <input type="checkbox" checked={alertLowStock} onChange={() => setAlertLowStock(!alertLowStock)} />
        </label>
      </div>
    </div>
  );
};
