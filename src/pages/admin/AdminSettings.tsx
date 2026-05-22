// Pantalla de configuracion administrativa.
// Se ve en /admin/configuracion y muestra opciones generales del sistema.
import React, { useState } from 'react';

// Componente de preferencias visuales del sistema.
export const AdminSettings: React.FC = () => {
  // Estados de interruptores que se ven como checkboxes en configuracion.
  const [notifications, setNotifications] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [alertLowStock, setAlertLowStock] = useState(true);

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>Configuración</h2>
        <p>Ajusta las opciones principales del sistema de gestión hotelera.</p>
      </div>

      {/* Tarjeta con opciones tipo interruptor. Actualmente son locales a esta pantalla. */}
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
