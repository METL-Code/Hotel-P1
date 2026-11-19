// Pantalla de auditoria general del sistema.
// Lee dbo.Auditoria en SQL Server mediante GET /api/audit (solo administradores).
import React, { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../../services/api';
import { getErrorMessage } from '../../utils/format';

interface AuditRow {
  Id: number;
  Tabla: string;
  RegistroId: number | null;
  Accion: string;
  UsuarioId: string | null;
  UsuarioNombre: string | null;
  DatosAnteriores: string | null;
  DatosNuevos: string | null;
  Motivo: string | null;
  CreatedAt: string;
}

interface AuditResponse {
  audit: AuditRow[];
}

const TABLES = ['', 'Usuarios', 'Habitaciones', 'Huespedes', 'Reservaciones', 'EntradasOcupacion', 'Configuracion'];

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es-CO');
};

export const AdminAudit: React.FC = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [tableFilter, setTableFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAudit = useCallback(async (selectedTable: string) => {
    setLoading(true);
    setError(null);
    try {
      const query = selectedTable ? `?table=${encodeURIComponent(selectedTable)}&limit=100` : '?limit=100';
      const data = await apiGet<AuditResponse>(`/api/audit${query}`);
      setRows(data.audit);
    } catch (err) {
      setError(`No se pudo cargar la auditoria: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAudit(tableFilter);
  }, [tableFilter, loadAudit]);

  return (
    <div className="admin-page">
      <div className="page-header page-header-row">
        <div>
          <h2>Auditoria</h2>
          <p>Historial real de creaciones, cambios de estado y eliminaciones en SQL Server.</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="date-filter-field">
            Filtrar por tabla
            <select value={tableFilter} onChange={(e) => setTableFilter(e.target.value)}>
              {TABLES.map((name) => (
                <option key={name || 'all'} value={name}>
                  {name || 'Todas las tablas'}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="admin-action-btn" disabled={loading} onClick={() => loadAudit(tableFilter)}>
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error ? <div className="feedback-banner feedback-error">{error}</div> : null}

      <div className="admin-card">
        <h3>Ultimos registros ({rows.length})</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Tabla</th>
                <th>Reg.</th>
                <th>Accion</th>
                <th>Motivo</th>
                <th>Cambio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.Id}>
                  <td>{formatDateTime(row.CreatedAt)}</td>
                  <td>{row.UsuarioNombre || 'Sistema'}</td>
                  <td>{row.Tabla}</td>
                  <td>{row.RegistroId ?? '-'}</td>
                  <td>{row.Accion}</td>
                  <td>{row.Motivo || '-'}</td>
                  <td>
                    <div className="audit-json">
                      {row.DatosNuevos || row.DatosAnteriores || '-'}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !rows.length ? (
                <tr><td colSpan={7}>No hay eventos de auditoria para mostrar.</td></tr>
              ) : null}
              {loading && !rows.length ? (
                <tr><td colSpan={7}>Cargando auditoria...</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
