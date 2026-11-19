// Pantalla de configuracion del sistema.
// Lee y guarda las preferencias reales en dbo.Configuracion de SQL Server.
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiSend } from '../../services/api';
import { getErrorMessage } from '../../utils/format';

interface SystemSettings {
  notifications: boolean;
  maintenanceMode: boolean;
  alertLowStock: boolean;
}

interface SettingsResponse {
  settings: SystemSettings;
}

export const AdminSettings: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [settings, setSettings] = useState<SystemSettings>({
    notifications: true,
    maintenanceMode: false,
    alertLowStock: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<SettingsResponse>('/api/settings')
      .then((data) => {
        if (!active) return;
        setSettings(data.settings);
      })
      .catch((error) => {
        if (!active) return;
        setFeedback({ type: 'error', message: `No se pudo cargar la configuracion: ${getErrorMessage(error)}` });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleSetting = async (key: keyof SystemSettings) => {
    if (!isAdmin || saving || loading) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setFeedback(null);
    setSaving(true);
    try {
      const data = await apiSend<SettingsResponse>('/api/settings', 'PUT', next);
      setSettings(data.settings);
      setFeedback({ type: 'success', message: 'Preferencias guardadas en SQL Server.' });
    } catch (error) {
      setSettings(settings);
      setFeedback({ type: 'error', message: `No se pudo guardar: ${getErrorMessage(error)}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>Configuracion</h2>
        <p>Ajusta las opciones principales del sistema de gestion hotelera guardadas en SQL Server.</p>
      </div>

      {!isAdmin ? (
        <div className="feedback-banner feedback-info">
          Modo lectura: solo los administradores pueden modificar las preferencias globales del sistema.
        </div>
      ) : null}

      {feedback ? (
        <div className={`feedback-banner ${feedback.type === 'error' ? 'feedback-error' : 'feedback-success'}`}>
          {feedback.message}
        </div>
      ) : null}

      <div className="admin-card settings-card">
        <h3>Preferencias del sistema {loading ? '(cargando...)' : ''}</h3>

        <label className="setting-row">
          <div>
            <strong>Notificaciones activas</strong>
            <p>Enviar alertas sobre nuevos registros y cambios.</p>
          </div>
          <input
            type="checkbox"
            checked={settings.notifications}
            disabled={!isAdmin || loading || saving}
            onChange={() => toggleSetting('notifications')}
          />
        </label>

        <label className="setting-row">
          <div>
            <strong>Modo mantenimiento</strong>
            <p>Deshabilita algunas funciones temporales.</p>
          </div>
          <input
            type="checkbox"
            checked={settings.maintenanceMode}
            disabled={!isAdmin || loading || saving}
            onChange={() => toggleSetting('maintenanceMode')}
          />
        </label>

        <label className="setting-row">
          <div>
            <strong>Alertas de stock</strong>
            <p>Recibir aviso cuando los suministros esten bajos.</p>
          </div>
          <input
            type="checkbox"
            checked={settings.alertLowStock}
            disabled={!isAdmin || loading || saving}
            onChange={() => toggleSetting('alertLowStock')}
          />
        </label>
      </div>
    </div>
  );
};
