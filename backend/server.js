// Servidor API del hotel.
// Se ejecuta con `npm run api` y atiende http://localhost:4000 (Vite redirige /api aqui).
// Si existe la carpeta dist/ tambien sirve el frontend compilado, para desplegar todo en un solo proceso.
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Configuracion
// ---------------------------------------------------------------------------

// Lee backend/.env para configurar SQL Server sin escribir datos sensibles en el codigo.
// Las variables de entorno reales del sistema tienen prioridad sobre el archivo.
const loadEnvFile = () => {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

loadEnvFile();

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || process.env.API_PORT || 4000);
const MAX_BODY_BYTES = 1024 * 1024;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;

// Driver de SQL Server:
// - msnodesqlv8: driver ODBC nativo, solo Windows. Permite Windows Authentication.
// - tedious: driver JavaScript puro, funciona en Linux/hosting. Requiere usuario y clave SQL.
const dbClient = (process.env.DB_CLIENT || (process.platform === 'win32' ? 'msnodesqlv8' : 'tedious')).toLowerCase();
const sql = (await import(dbClient === 'tedious' ? 'mssql' : 'mssql/msnodesqlv8.js')).default;

const dbConnectionTimeoutMs = Number(process.env.DB_CONNECTION_TIMEOUT || 10000);
const dbRequestTimeoutMs = Number(process.env.DB_REQUEST_TIMEOUT || 15000);
const sqlServerHost = process.env.DB_SERVER || 'localhost';
const sqlInstance = process.env.DB_INSTANCE || '';
const sqlDatabase = process.env.DB_DATABASE || 'HotelDB';
const sqlUser = process.env.DB_USER || '';
const sqlPassword = process.env.DB_PASSWORD || '';
const useSqlAuthentication = Boolean(sqlUser && sqlPassword);
const dbEncrypt = process.env.DB_ENCRYPT === 'true';
const dbTrustServerCertificate = process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false';

// Configuracion para msnodesqlv8 (ODBC). Usa SQL Authentication si hay usuario/clave; si no, Windows Authentication.
const buildNativeConfig = () => {
  const server = sqlInstance ? `${sqlServerHost}\\${sqlInstance}` : sqlServerHost;
  return {
    connectionString: [
      `Driver={${process.env.DB_DRIVER || 'ODBC Driver 17 for SQL Server'}}`,
      `Server=${server}`,
      `Database=${sqlDatabase}`,
      useSqlAuthentication ? `UID=${sqlUser}` : 'Trusted_Connection=Yes',
      useSqlAuthentication ? `PWD=${sqlPassword}` : '',
      `Connection Timeout=${Math.max(1, Math.ceil(dbConnectionTimeoutMs / 1000))}`,
      `Encrypt=${dbEncrypt ? 'Yes' : 'No'}`,
      dbTrustServerCertificate ? 'TrustServerCertificate=Yes' : '',
      process.env.DB_EXTRA || ''
    ].filter(Boolean).join(';'),
    server,
    database: sqlDatabase,
    user: useSqlAuthentication ? sqlUser : undefined,
    password: useSqlAuthentication ? sqlPassword : undefined,
    driver: 'msnodesqlv8',
    connectionTimeout: dbConnectionTimeoutMs,
    requestTimeout: dbRequestTimeoutMs,
    options: {
      trustedConnection: !useSqlAuthentication && process.env.DB_TRUSTED_CONNECTION !== 'false',
      encrypt: dbEncrypt,
      trustServerCertificate: dbTrustServerCertificate
    }
  };
};

// Configuracion para tedious. DB_SERVER acepta "host" o "host,puerto".
const buildTediousConfig = () => {
  if (!useSqlAuthentication) {
    throw new Error('DB_CLIENT=tedious requiere DB_USER y DB_PASSWORD (Windows Authentication solo funciona con msnodesqlv8).');
  }
  const [host, portText] = sqlServerHost.split(',').map((part) => part.trim());
  const config = {
    server: host,
    database: sqlDatabase,
    user: sqlUser,
    password: sqlPassword,
    connectionTimeout: dbConnectionTimeoutMs,
    requestTimeout: dbRequestTimeoutMs,
    options: {
      encrypt: dbEncrypt,
      trustServerCertificate: dbTrustServerCertificate
    }
  };
  if (sqlInstance) config.options.instanceName = sqlInstance;
  else if (portText) config.port = Number(portText);
  return config;
};

const dbConfig = dbClient === 'tedious' ? buildTediousConfig() : buildNativeConfig();

// Origenes permitidos para CORS (solo necesario si el frontend se sirve desde otro dominio).
// Ejemplo: CORS_ORIGIN=https://mi-hotel.vercel.app
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((item) => item.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
// Utilidades generales
// ---------------------------------------------------------------------------

// Error controlado: se responde al cliente con su status y mensaje.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

// Valida un texto obligatorio u opcional con longitud maxima segun la columna SQL.
const requireText = (value, label, max, { required = true } = {}) => {
  const result = text(value);
  if (required && !result) throw new HttpError(400, `${label} es obligatorio`);
  if (result.length > max) throw new HttpError(400, `${label} no puede superar ${max} caracteres`);
  return result;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const requireEmail = (value, { required = true } = {}) => {
  const email = requireText(value, 'El email', 150, { required });
  if (email && !emailPattern.test(email)) throw new HttpError(400, 'El email no es valido');
  return email;
};

const validatePassword = (value) => {
  const password = typeof value === 'string' ? value : '';
  if (password.length < MIN_PASSWORD_LENGTH) throw new HttpError(400, `La clave debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  if (password.length > MAX_PASSWORD_LENGTH) throw new HttpError(400, `La clave no puede superar ${MAX_PASSWORD_LENGTH} caracteres`);
  return password;
};

// Fecha valida en formato YYYY-MM-DD (rechaza 2026-02-30, etc.).
const isValidDateText = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

// Convierte fechas de SQL Server o strings al formato YYYY-MM-DD usado por React.
const toDateValue = (value) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const isDuplicateKeyError = (error) => error?.number === 2627 || error?.number === 2601;

// ---------------------------------------------------------------------------
// Conexion SQL, migraciones minimas y transacciones
// ---------------------------------------------------------------------------

// Funcionalidades opcionales que dependen de columnas/tablas nuevas del esquema.
const schemaFeatures = { reservationProcessedAt: false, settingsTable: false };

// Agrega columnas/tablas nuevas si faltan, para que una base existente siga funcionando sin pasos manuales.
// Si el usuario SQL no tiene permisos de DDL, el backend sigue funcionando con aviso.
const ensureSchema = async (pool) => {
  try {
    const result = await pool.request().query(`SELECT COL_LENGTH('dbo.Reservaciones', 'ProcessedAt') AS Len`);
    if (result.recordset[0]?.Len === null) {
      await pool.request().query('ALTER TABLE dbo.Reservaciones ADD ProcessedAt DATETIME2 NULL');
      console.log('Esquema actualizado: columna dbo.Reservaciones.ProcessedAt creada.');
    }
    schemaFeatures.reservationProcessedAt = true;
  } catch (error) {
    console.warn('No se pudo verificar/crear dbo.Reservaciones.ProcessedAt. Ejecuta backend/schema.sql.', error?.message);
  }

  try {
    const tableCheck = await pool.request().query(`SELECT OBJECT_ID('dbo.Configuracion', 'U') AS ObjId`);
    if (tableCheck.recordset[0]?.ObjId === null) {
      await pool.request().query(`
        CREATE TABLE dbo.Configuracion (
          Clave NVARCHAR(100) PRIMARY KEY,
          Valor NVARCHAR(500) NOT NULL,
          UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
          UpdatedBy NVARCHAR(100) NULL
        )
      `);
      console.log('Esquema actualizado: tabla dbo.Configuracion creada.');
    }
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion WHERE Clave = 'notifications')
        INSERT INTO dbo.Configuracion (Clave, Valor) VALUES ('notifications', 'true');
      IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion WHERE Clave = 'maintenanceMode')
        INSERT INTO dbo.Configuracion (Clave, Valor) VALUES ('maintenanceMode', 'false');
      IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion WHERE Clave = 'alertLowStock')
        INSERT INTO dbo.Configuracion (Clave, Valor) VALUES ('alertLowStock', 'true');
    `);
    schemaFeatures.settingsTable = true;
  } catch (error) {
    console.warn('No se pudo verificar/crear dbo.Configuracion. Ejecuta backend/schema.sql.', error?.message);
  }
};

// Pool compartido de conexion a SQL Server con recuperacion automatica ante desconexiones.
let poolPromise;
const resetPool = () => {
  poolPromise = undefined;
};

const getPool = async () => {
  if (poolPromise) {
    try {
      const existing = await poolPromise;
      if (existing.connected) return existing;
    } catch {
      // Si fallo el intento anterior, se crea un pool nuevo.
    }
    poolPromise = undefined;
  }

  poolPromise = new sql.ConnectionPool(dbConfig).connect()
    .then(async (pool) => {
      pool.on('error', (error) => {
        console.error('[SQL Pool]', error?.message);
        resetPool();
      });
      await ensureSchema(pool);
      return pool;
    })
    .catch((error) => {
      resetPool();
      throw error;
    });

  return poolPromise;
};

// Ejecuta varias operaciones como una sola unidad: o se guardan todas o ninguna.
// Si el pool quedo desconectado en reposo, reintenta una vez reconectando al servidor SQL.
const withTransaction = async (work) => {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();
    } catch (error) {
      lastError = error;
      if (attempt === 0 && isDbConnectionError(error)) {
        resetPool();
        continue;
      }
      throw error;
    }

    try {
      const result = await work(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      try {
        await transaction.rollback();
      } catch {
        // La transaccion pudo haberse abortado ya por SQL Server.
      }
      if (isDbConnectionError(error)) resetPool();
      throw error;
    }
  }
  throw lastError;
};

// ---------------------------------------------------------------------------
// Seguridad: claves, tokens y limite de intentos de login
// ---------------------------------------------------------------------------

const scryptAsync = promisify(crypto.scrypt);
const HASH_PREFIX = 'scrypt';

// Genera un hash con sal aleatoria: scrypt$<sal>$<hash>.
const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `${HASH_PREFIX}$${salt.toString('base64')}$${hash.toString('base64')}`;
};

const safeEqual = (a, b) => a.length === b.length && crypto.timingSafeEqual(a, b);

// Compara una clave con la guardada. Acepta claves antiguas en texto plano y avisa que deben migrarse.
const verifyPassword = async (password, stored) => {
  if (typeof stored !== 'string' || !stored) return { valid: false, needsRehash: false };

  if (stored.startsWith(`${HASH_PREFIX}$`)) {
    const [, saltB64, hashB64] = stored.split('$');
    const expected = Buffer.from(hashB64 || '', 'base64');
    if (!saltB64 || !expected.length) return { valid: false, needsRehash: false };
    const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length);
    return { valid: safeEqual(actual, expected), needsRehash: false };
  }

  const valid = safeEqual(Buffer.from(String(password)), Buffer.from(stored));
  return { valid, needsRehash: valid };
};

// Hash ficticio para que el tiempo de respuesta sea similar exista o no el usuario.
const DUMMY_HASH = await hashPassword(crypto.randomBytes(16).toString('hex'));

const TOKEN_TTL_SECONDS = Math.max(1, Number(process.env.TOKEN_TTL_HOURS || 12)) * 3600;
let tokenSecret = process.env.JWT_SECRET || '';
if (tokenSecret.length < 32) {
  if (isProduction) {
    console.error('JWT_SECRET es obligatorio en produccion y debe tener al menos 32 caracteres.');
    process.exit(1);
  }
  tokenSecret = crypto.randomBytes(48).toString('hex');
  console.warn('JWT_SECRET no definido: se uso uno temporal. Las sesiones se cerraran al reiniciar el backend.');
}

const base64url = (value) => Buffer.from(value).toString('base64url');
const signPart = (data) => crypto.createHmac('sha256', tokenSecret).update(data).digest();

// Token firmado compatible con JWT (HS256).
const signToken = (payload) => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS }));
  return `${header}.${body}.${signPart(`${header}.${body}`).toString('base64url')}`;
};

const verifyToken = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  if (!safeEqual(Buffer.from(signature, 'base64url'), signPart(`${header}.${body}`))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};

// Limite simple de intentos fallidos por IP + usuario para frenar ataques de fuerza bruta.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map();

const loginKey = (req, username) => `${req.socket.remoteAddress || ''}|${username.toLowerCase()}`;

const isLoginBlocked = (key) => {
  const entry = loginAttempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
};

const registerFailedLogin = (key) => {
  if (loginAttempts.size > 10000) loginAttempts.clear();
  const entry = loginAttempts.get(key);
  if (!entry || Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAt: Date.now() });
  } else {
    entry.count += 1;
  }
};

// ---------------------------------------------------------------------------
// HTTP: lectura de body, respuestas, CORS
// ---------------------------------------------------------------------------

// Lee el body JSON de forma segura para UTF-8 y con limite de tamano.
const readJson = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  let finished = false;

  req.on('data', (chunk) => {
    if (finished) return;
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      finished = true;
      req.resume();
      reject(new HttpError(413, 'La peticion es demasiado grande'));
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (finished) return;
    finished = true;
    try {
      const body = chunks.length ? Buffer.concat(chunks).toString('utf8') : '';
      const parsed = body ? JSON.parse(body) : {};
      resolve(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
    } catch {
      reject(new HttpError(400, 'JSON invalido'));
    }
  });
  req.on('error', (error) => {
    if (finished) return;
    finished = true;
    reject(error);
  });
});

const corsHeaders = (req) => {
  const origin = req?.headers?.origin;
  if (!origin || !allowedOrigins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin'
  };
};

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer'
};

// Responde siempre JSON.
const sendJson = (res, status, payload) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...securityHeaders,
    ...corsHeaders(res.req)
  });
  res.end(JSON.stringify(payload));
};

// ---------------------------------------------------------------------------
// Mapeo de filas SQL al modelo del frontend
// ---------------------------------------------------------------------------

const validRoles = new Set(['admin', 'trabajador']);
const validRoomStatuses = new Set(['Disponible', 'Ocupada', 'Mantenimiento']);
const validReservationStatuses = new Set(['Confirmada', 'Pendiente', 'Cancelada']);
const validClientTypes = new Set(['Persona comun', 'Persona recurrente']);

// Nunca incluye la clave: ni en respuestas ni en auditoria.
const mapUser = (row) => ({
  id: row.Id,
  nombres: row.Nombres,
  apellidos: row.Apellidos,
  username: row.Username,
  email: row.Email,
  role: row.Role,
  status: row.Status
});

// Datos minimos del usuario logueado que necesita el frontend.
const publicUser = (user) => ({
  id: String(user.id),
  username: user.username,
  email: user.email,
  role: user.role
});

const mapRoom = (row) => ({
  id: row.Id,
  number: row.Numero,
  type: row.Tipo,
  status: row.Estado,
  note: row.Nota || undefined
});

const mapGuest = (row) => ({
  id: row.Id,
  cedula: row.Cedula,
  nombres: row.Nombres,
  apellidos: row.Apellidos,
  email: row.Email || undefined
});

const mapReservation = (row) => ({
  id: row.Id,
  guest: row.GuestName,
  room: row.RoomNumber,
  price: row.Price === null || row.Price === undefined ? undefined : Number(row.Price),
  clientType: row.ClientType || undefined,
  status: row.Status,
  checkin: toDateValue(row.CheckinDate),
  checkout: toDateValue(row.CheckoutDate),
  cancellationReason: row.CancellationReason || undefined
});

const mapOccupancyEntry = (row) => ({
  id: row.Id,
  roomId: row.RoomId === null || row.RoomId === undefined ? 0 : row.RoomId,
  roomNumber: row.RoomNumber,
  guestName: row.GuestName,
  price: Number(row.Price),
  clientType: row.ClientType,
  date: toDateValue(row.EntryDate),
  status: row.Status,
  cancellationReason: row.CancellationReason || undefined,
  canceledAt: toDateValue(row.CanceledAt)
});

const USER_COLUMNS = 'Id, Nombres, Apellidos, Username, Email, Role, Status';
const ROOM_COLUMNS = 'Id, Numero, Tipo, Estado, Nota';
const GUEST_COLUMNS = 'Id, Cedula, Nombres, Apellidos, Email';
const RESERVATION_COLUMNS = 'Id, GuestName, RoomNumber, Price, ClientType, Status, CheckinDate, CheckoutDate, CancellationReason';
const OCCUPANCY_COLUMNS = 'Id, RoomId, RoomNumber, GuestId, GuestName, Price, ClientType, EntryDate, Status, CancellationReason, CanceledAt';
const outputColumns = (columns) => columns.split(',').map((column) => `inserted.${column.trim()}`).join(', ');

// `db` puede ser el pool o una transaccion: ambos exponen request().
const lockHint = (lock) => (lock ? 'WITH (UPDLOCK, HOLDLOCK)' : '');

// Guarda una fila de auditoria con datos anteriores/nuevos en JSON.
const writeAudit = async (db, { table, recordId, action, actor, before, after, reason }) => {
  await db.request()
    .input('tabla', sql.NVarChar(100), table)
    .input('registroId', sql.Int, recordId ?? null)
    .input('accion', sql.NVarChar(50), action)
    .input('usuarioId', sql.NVarChar(50), actor?.userId ?? null)
    .input('usuarioNombre', sql.NVarChar(150), actor?.username ?? 'Sistema')
    .input('datosAnteriores', sql.NVarChar(sql.MAX), before ? JSON.stringify(before) : null)
    .input('datosNuevos', sql.NVarChar(sql.MAX), after ? JSON.stringify(after) : null)
    .input('motivo', sql.NVarChar(500), reason ? String(reason).slice(0, 500) : null)
    .query(`
      INSERT INTO dbo.Auditoria (Tabla, RegistroId, Accion, UsuarioId, UsuarioNombre, DatosAnteriores, DatosNuevos, Motivo)
      VALUES (@tabla, @registroId, @accion, @usuarioId, @usuarioNombre, @datosAnteriores, @datosNuevos, @motivo)
    `);
};

const getUserById = async (db, id) => {
  const result = await db.request()
    .input('id', sql.Int, id)
    .query(`SELECT ${USER_COLUMNS} FROM dbo.Usuarios WHERE Id = @id AND IsDeleted = 0`);
  return result.recordset.length ? mapUser(result.recordset[0]) : null;
};

// Evita dejar el sistema sin ningun administrador activo.
const ensureAnotherActiveAdmin = async (db, excludedId) => {
  const result = await db.request()
    .input('id', sql.Int, excludedId)
    .query(`
      SELECT COUNT(*) AS Total
      FROM dbo.Usuarios
      WHERE Role = 'admin' AND Status = 'Activo' AND IsDeleted = 0 AND Id <> @id
    `);
  if (!result.recordset[0]?.Total) {
    throw new HttpError(409, 'Debe quedar al menos un administrador activo');
  }
};

const getRoomById = async (db, id, { lock = false } = {}) => {
  const result = await db.request()
    .input('id', sql.Int, id)
    .query(`SELECT ${ROOM_COLUMNS} FROM dbo.Habitaciones ${lockHint(lock)} WHERE Id = @id AND IsDeleted = 0`);
  return result.recordset.length ? mapRoom(result.recordset[0]) : null;
};

const getRoomByNumber = async (db, number, { lock = false } = {}) => {
  const result = await db.request()
    .input('numero', sql.NVarChar(20), number)
    .query(`SELECT ${ROOM_COLUMNS} FROM dbo.Habitaciones ${lockHint(lock)} WHERE Numero = @numero AND IsDeleted = 0`);
  return result.recordset.length ? mapRoom(result.recordset[0]) : null;
};

const getReservationById = async (db, id, { lock = false } = {}) => {
  const result = await db.request()
    .input('id', sql.Int, id)
    .query(`SELECT ${RESERVATION_COLUMNS} FROM dbo.Reservaciones ${lockHint(lock)} WHERE Id = @id AND IsDeleted = 0`);
  return result.recordset.length ? mapReservation(result.recordset[0]) : null;
};

// Actualiza estado y nota de una habitacion y devuelve la fila nueva.
const setRoomState = async (db, roomId, status, note) => {
  const result = await db.request()
    .input('id', sql.Int, roomId)
    .input('estado', sql.NVarChar(30), status)
    .input('nota', sql.NVarChar(500), note ? String(note).slice(0, 500) : null)
    .query(`
      UPDATE dbo.Habitaciones
      SET Estado = @estado,
          Nota = @nota,
          UpdatedAt = SYSDATETIME()
      OUTPUT ${outputColumns(ROOM_COLUMNS)}
      WHERE Id = @id AND IsDeleted = 0
    `);
  if (!result.recordset.length) throw new HttpError(404, 'Habitacion no encontrada');
  return mapRoom(result.recordset[0]);
};

// Reglas de cambio de estado manual de una habitacion.
// "Ocupada" solo se asigna registrando una ocupacion (con huesped y valor) o confirmando una llegada.
const assertManualStatusChange = (room, nextStatus) => {
  if (nextStatus === 'Ocupada' && room.status !== 'Ocupada') {
    throw new HttpError(400, 'Para ocupar una habitacion registra la ocupacion con los datos del huesped');
  }
};

// Crea una entrada de ocupacion (registro financiero usado por los informes).
const insertOccupancyEntry = async (db, { room, guestId, guestName, price, clientType }) => {
  const result = await db.request()
    .input('roomId', sql.Int, room.id)
    .input('roomNumber', sql.NVarChar(20), room.number)
    .input('guestId', sql.Int, guestId ?? null)
    .input('guestName', sql.NVarChar(200), guestName)
    .input('price', sql.Decimal(12, 2), price)
    .input('clientType', sql.NVarChar(30), clientType)
    .query(`
      INSERT INTO dbo.EntradasOcupacion (RoomId, RoomNumber, GuestId, GuestName, Price, ClientType, EntryDate, Status)
      OUTPUT ${outputColumns(OCCUPANCY_COLUMNS)}
      VALUES (@roomId, @roomNumber, @guestId, @guestName, @price, @clientType, CONVERT(date, SYSDATETIME()), 'Activa')
    `);
  return mapOccupancyEntry(result.recordset[0]);
};

// Crea o actualiza un huesped por cedula.
const saveGuest = async (db, payload, actor) => {
  const cedula = requireText(payload.cedula, 'La cedula', 50);
  const nombres = requireText(payload.nombres, 'Los nombres', 100);
  const apellidos = requireText(payload.apellidos, 'Los apellidos', 100);
  const email = requireEmail(payload.email, { required: false }) || null;

  const previousResult = await db.request()
    .input('cedula', sql.NVarChar(50), cedula)
    .query(`SELECT ${GUEST_COLUMNS} FROM dbo.Huespedes WITH (UPDLOCK, HOLDLOCK) WHERE Cedula = @cedula AND IsDeleted = 0`);

  if (previousResult.recordset.length) {
    const previous = mapGuest(previousResult.recordset[0]);
    const result = await db.request()
      .input('id', sql.Int, previous.id)
      .input('nombres', sql.NVarChar(100), nombres)
      .input('apellidos', sql.NVarChar(100), apellidos)
      .input('email', sql.NVarChar(150), email)
      .query(`
        UPDATE dbo.Huespedes
        SET Nombres = @nombres,
            Apellidos = @apellidos,
            Email = @email,
            UpdatedAt = SYSDATETIME()
        OUTPUT ${outputColumns(GUEST_COLUMNS)}
        WHERE Id = @id AND IsDeleted = 0
      `);
    const guest = mapGuest(result.recordset[0]);
    await writeAudit(db, { table: 'Huespedes', recordId: guest.id, action: 'UPDATE', actor, before: previous, after: guest, reason: 'Actualizacion de huesped' });
    return guest;
  }

  const result = await db.request()
    .input('cedula', sql.NVarChar(50), cedula)
    .input('nombres', sql.NVarChar(100), nombres)
    .input('apellidos', sql.NVarChar(100), apellidos)
    .input('email', sql.NVarChar(150), email)
    .query(`
      INSERT INTO dbo.Huespedes (Cedula, Nombres, Apellidos, Email)
      OUTPUT ${outputColumns(GUEST_COLUMNS)}
      VALUES (@cedula, @nombres, @apellidos, @email)
    `);
  const guest = mapGuest(result.recordset[0]);
  await writeAudit(db, { table: 'Huespedes', recordId: guest.id, action: 'CREATE', actor, before: null, after: guest, reason: 'Creacion de huesped' });
  return guest;
};

// ---------------------------------------------------------------------------
// Autenticacion de cada peticion
// ---------------------------------------------------------------------------

// Valida el token Bearer y vuelve a leer el usuario en SQL: si fue desactivado o eliminado, pierde acceso.
// El rol siempre se toma de la base de datos, nunca del cliente.
const authenticate = async (req) => {
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  const payload = match ? verifyToken(match[1]) : null;
  if (!payload) throw new HttpError(401, 'Sesion invalida o expirada. Inicia sesion de nuevo.');

  const pool = await getPool();
  const user = await getUserById(pool, Number(payload.sub));
  if (!user || user.status !== 'Activo') throw new HttpError(401, 'Sesion invalida o expirada. Inicia sesion de nuevo.');
  return user;
};

// ---------------------------------------------------------------------------
// Endpoints: sistema y autenticacion
// ---------------------------------------------------------------------------

// GET /api/health: comprueba que la API y la base de datos responden.
const health = async ({ res }) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');
    sendJson(res, 200, { ok: true, database: 'up' });
  } catch (error) {
    console.error('[health]', error?.message);
    sendJson(res, 503, { ok: false, database: 'down' });
  }
};

// POST /api/auth/login
const login = async ({ req, res }) => {
  const body = await readJson(req);
  const username = text(body.username);
  const password = typeof body.password === 'string' ? body.password : '';
  const role = text(body.role);

  if (!username || !password || !validRoles.has(role)) {
    throw new HttpError(400, 'Usuario, contrasena y rol son obligatorios');
  }

  const key = loginKey(req, username);
  if (isLoginBlocked(key)) {
    throw new HttpError(429, 'Demasiados intentos fallidos. Espera 15 minutos e intenta de nuevo.');
  }

  const pool = await getPool();
  const result = await pool.request()
    .input('username', sql.NVarChar(100), username)
    .input('role', sql.NVarChar(20), role)
    .query(`
      SELECT TOP 1 ${USER_COLUMNS}, Password
      FROM dbo.Usuarios
      WHERE Username = @username AND Role = @role AND IsDeleted = 0
    `);

  const row = result.recordset[0];
  const { valid, needsRehash } = await verifyPassword(password, row ? row.Password : DUMMY_HASH);

  if (!row || !valid) {
    registerFailedLogin(key);
    throw new HttpError(401, 'Usuario o contrasena incorrectos');
  }

  if (row.Status !== 'Activo') {
    throw new HttpError(403, 'Este usuario esta inactivo');
  }

  // Migracion transparente: las claves antiguas en texto plano se guardan como hash al iniciar sesion.
  if (needsRehash) {
    try {
      await pool.request()
        .input('id', sql.Int, row.Id)
        .input('password', sql.NVarChar(255), await hashPassword(password))
        .query('UPDATE dbo.Usuarios SET Password = @password, UpdatedAt = SYSDATETIME() WHERE Id = @id');
    } catch (error) {
      console.warn('No se pudo migrar la clave a hash para el usuario', row.Id, error?.message);
    }
  }

  loginAttempts.delete(key);
  const user = mapUser(row);
  const token = signToken({ sub: String(user.id), username: user.username, role: user.role });
  sendJson(res, 200, { token, user: publicUser(user) });
};

// GET /api/auth/me: valida la sesion guardada en el navegador y devuelve datos actualizados.
const me = async ({ res, user }) => {
  sendJson(res, 200, { user: publicUser(user) });
};

// ---------------------------------------------------------------------------
// Endpoints: usuarios (solo admin)
// ---------------------------------------------------------------------------

const listUsers = async ({ res }) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT ${USER_COLUMNS}
    FROM dbo.Usuarios
    WHERE IsDeleted = 0
    ORDER BY Id
  `);
  sendJson(res, 200, { users: result.recordset.map(mapUser) });
};

const readUserFields = (payload) => {
  const role = text(payload.role);
  if (!validRoles.has(role)) throw new HttpError(400, 'Rol invalido');
  return {
    nombres: requireText(payload.nombres, 'Los nombres', 100),
    apellidos: requireText(payload.apellidos, 'Los apellidos', 100),
    username: requireText(payload.username, 'El usuario', 100),
    email: requireEmail(payload.email),
    role
  };
};

const createUser = async ({ req, res, actor }) => {
  const payload = await readJson(req);
  const fields = readUserFields(payload);
  const passwordHash = await hashPassword(validatePassword(payload.password));

  try {
    const user = await withTransaction(async (tx) => {
      const result = await tx.request()
        .input('nombres', sql.NVarChar(100), fields.nombres)
        .input('apellidos', sql.NVarChar(100), fields.apellidos)
        .input('username', sql.NVarChar(100), fields.username)
        .input('email', sql.NVarChar(150), fields.email)
        .input('password', sql.NVarChar(255), passwordHash)
        .input('role', sql.NVarChar(20), fields.role)
        .query(`
          INSERT INTO dbo.Usuarios (Nombres, Apellidos, Username, Email, Password, Role, Status)
          OUTPUT ${outputColumns(USER_COLUMNS)}
          VALUES (@nombres, @apellidos, @username, @email, @password, @role, 'Activo')
        `);
      const created = mapUser(result.recordset[0]);
      await writeAudit(tx, { table: 'Usuarios', recordId: created.id, action: 'CREATE', actor, before: null, after: created, reason: 'Creacion de usuario' });
      return created;
    });
    sendJson(res, 201, { user });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new HttpError(409, 'Ya existe un usuario con ese usuario o email');
    throw error;
  }
};

// PUT /api/users/:id. Si llega `password` no vacia, tambien cambia la clave.
const updateUser = async ({ req, res, id, actor, user: currentUser }) => {
  const payload = await readJson(req);
  const fields = readUserFields(payload);
  const newPassword = typeof payload.password === 'string' && payload.password.length ? validatePassword(payload.password) : null;
  const passwordHash = newPassword ? await hashPassword(newPassword) : null;

  if (id === currentUser.id && fields.role !== 'admin') {
    throw new HttpError(400, 'No puedes quitarte a ti mismo el rol de administrador');
  }

  try {
    const user = await withTransaction(async (tx) => {
      const previous = await getUserById(tx, id);
      if (!previous) throw new HttpError(404, 'Usuario no encontrado');

      if (previous.role === 'admin' && previous.status === 'Activo' && fields.role !== 'admin') {
        await ensureAnotherActiveAdmin(tx, id);
      }

      const result = await tx.request()
        .input('id', sql.Int, id)
        .input('nombres', sql.NVarChar(100), fields.nombres)
        .input('apellidos', sql.NVarChar(100), fields.apellidos)
        .input('username', sql.NVarChar(100), fields.username)
        .input('email', sql.NVarChar(150), fields.email)
        .input('role', sql.NVarChar(20), fields.role)
        .input('password', sql.NVarChar(255), passwordHash)
        .query(`
          UPDATE dbo.Usuarios
          SET Nombres = @nombres,
              Apellidos = @apellidos,
              Username = @username,
              Email = @email,
              Role = @role,
              Password = COALESCE(@password, Password),
              UpdatedAt = SYSDATETIME()
          OUTPUT ${outputColumns(USER_COLUMNS)}
          WHERE Id = @id AND IsDeleted = 0
        `);

      const updated = mapUser(result.recordset[0]);
      const reason = text(payload.reason) || (passwordHash ? 'Actualizacion de usuario y cambio de clave' : 'Actualizacion de usuario');
      await writeAudit(tx, { table: 'Usuarios', recordId: id, action: 'UPDATE', actor, before: previous, after: updated, reason });
      return updated;
    });
    sendJson(res, 200, { user });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new HttpError(409, 'Ya existe un usuario con ese usuario o email');
    throw error;
  }
};

// PATCH /api/users/:id: alterna Activo/Inactivo.
const toggleUserStatus = async ({ res, id, actor, user: currentUser }) => {
  if (id === currentUser.id) throw new HttpError(400, 'No puedes desactivar tu propio usuario');

  const user = await withTransaction(async (tx) => {
    const previous = await getUserById(tx, id);
    if (!previous) throw new HttpError(404, 'Usuario no encontrado');
    if (previous.role === 'admin' && previous.status === 'Activo') await ensureAnotherActiveAdmin(tx, id);

    const result = await tx.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE dbo.Usuarios
        SET Status = CASE WHEN Status = 'Activo' THEN 'Inactivo' ELSE 'Activo' END,
            UpdatedAt = SYSDATETIME()
        OUTPUT ${outputColumns(USER_COLUMNS)}
        WHERE Id = @id AND IsDeleted = 0
      `);
    const updated = mapUser(result.recordset[0]);
    await writeAudit(tx, { table: 'Usuarios', recordId: id, action: 'STATUS_CHANGE', actor, before: previous, after: updated, reason: 'Cambio de estado de usuario' });
    return updated;
  });
  sendJson(res, 200, { user });
};

// DELETE /api/users/:id: borrado logico.
const deleteUser = async ({ req, res, id, actor, user: currentUser }) => {
  const payload = await readJson(req);
  if (id === currentUser.id) throw new HttpError(400, 'No puedes eliminar tu propio usuario');

  await withTransaction(async (tx) => {
    const previous = await getUserById(tx, id);
    if (!previous) throw new HttpError(404, 'Usuario no encontrado');
    if (previous.role === 'admin' && previous.status === 'Activo') await ensureAnotherActiveAdmin(tx, id);

    const deletedBy = actor.username;
    await tx.request()
      .input('id', sql.Int, id)
      .input('deletedBy', sql.NVarChar(100), deletedBy)
      .query(`
        UPDATE dbo.Usuarios
        SET IsDeleted = 1,
            DeletedAt = SYSDATETIME(),
            DeletedBy = @deletedBy,
            UpdatedAt = SYSDATETIME()
        WHERE Id = @id AND IsDeleted = 0
      `);
    await writeAudit(tx, { table: 'Usuarios', recordId: id, action: 'DELETE', actor, before: previous, after: { ...previous, isDeleted: true, deletedBy }, reason: text(payload.reason) || 'Eliminacion logica de usuario' });
  });
  sendJson(res, 200, { ok: true });
};

// ---------------------------------------------------------------------------
// Endpoints: habitaciones
// ---------------------------------------------------------------------------

const listRooms = async ({ res }) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT ${ROOM_COLUMNS}
    FROM dbo.Habitaciones
    WHERE IsDeleted = 0
    ORDER BY Numero
  `);
  sendJson(res, 200, { rooms: result.recordset.map(mapRoom) });
};

// POST /api/rooms (admin)
const createRoom = async ({ req, res, actor }) => {
  const payload = await readJson(req);
  const number = requireText(payload.number, 'El numero', 20);
  const type = requireText(payload.type, 'El tipo', 50);
  const status = text(payload.status) || 'Disponible';
  const note = requireText(payload.note, 'La nota', 500, { required: false }) || null;

  if (!validRoomStatuses.has(status)) throw new HttpError(400, 'Estado de habitacion invalido');
  if (status === 'Ocupada') throw new HttpError(400, 'Una habitacion nueva solo puede estar Disponible o en Mantenimiento');

  try {
    const room = await withTransaction(async (tx) => {
      const result = await tx.request()
        .input('numero', sql.NVarChar(20), number)
        .input('tipo', sql.NVarChar(50), type)
        .input('estado', sql.NVarChar(30), status)
        .input('nota', sql.NVarChar(500), note)
        .query(`
          INSERT INTO dbo.Habitaciones (Numero, Tipo, Estado, Nota)
          OUTPUT ${outputColumns(ROOM_COLUMNS)}
          VALUES (@numero, @tipo, @estado, @nota)
        `);
      const created = mapRoom(result.recordset[0]);
      await writeAudit(tx, { table: 'Habitaciones', recordId: created.id, action: 'CREATE', actor, before: null, after: created, reason: 'Creacion de habitacion' });
      return created;
    });
    sendJson(res, 201, { room });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new HttpError(409, 'Ya existe una habitacion con ese numero');
    throw error;
  }
};

// PUT /api/rooms/:id (admin): numero, tipo, estado y nota.
const updateRoom = async ({ req, res, id, actor }) => {
  const payload = await readJson(req);

  try {
    const room = await withTransaction(async (tx) => {
      const previous = await getRoomById(tx, id, { lock: true });
      if (!previous) throw new HttpError(404, 'Habitacion no encontrada');

      const number = requireText(payload.number ?? previous.number, 'El numero', 20);
      const type = requireText(payload.type ?? previous.type, 'El tipo', 50);
      const status = text(payload.status ?? previous.status);
      const note = payload.note === undefined ? previous.note ?? null : requireText(payload.note, 'La nota', 500, { required: false }) || null;

      if (!validRoomStatuses.has(status)) throw new HttpError(400, 'Estado de habitacion invalido');
      assertManualStatusChange(previous, status);

      const result = await tx.request()
        .input('id', sql.Int, id)
        .input('numero', sql.NVarChar(20), number)
        .input('tipo', sql.NVarChar(50), type)
        .input('estado', sql.NVarChar(30), status)
        .input('nota', sql.NVarChar(500), note)
        .query(`
          UPDATE dbo.Habitaciones
          SET Numero = @numero,
              Tipo = @tipo,
              Estado = @estado,
              Nota = @nota,
              UpdatedAt = SYSDATETIME()
          OUTPUT ${outputColumns(ROOM_COLUMNS)}
          WHERE Id = @id AND IsDeleted = 0
        `);
      const updated = mapRoom(result.recordset[0]);

      // Las reservas guardan el numero de habitacion: si cambia, se actualizan para no perder el vinculo.
      if (updated.number !== previous.number) {
        await tx.request()
          .input('oldNumber', sql.NVarChar(20), previous.number)
          .input('newNumber', sql.NVarChar(20), updated.number)
          .query(`
            UPDATE dbo.Reservaciones
            SET RoomNumber = @newNumber, UpdatedAt = SYSDATETIME()
            WHERE RoomNumber = @oldNumber AND IsDeleted = 0
          `);
      }

      await writeAudit(tx, { table: 'Habitaciones', recordId: id, action: 'UPDATE', actor, before: previous, after: updated, reason: text(payload.reason) || 'Actualizacion de habitacion' });
      return updated;
    });
    sendJson(res, 200, { room });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new HttpError(409, 'Ya existe una habitacion con ese numero');
    throw error;
  }
};

// PATCH /api/rooms/:id/status: cambia estado (p. ej. salida del huesped -> Mantenimiento).
const updateRoomStatusApi = async ({ req, res, id, actor }) => {
  const payload = await readJson(req);
  const status = text(payload.status);
  if (!validRoomStatuses.has(status)) throw new HttpError(400, 'Estado de habitacion invalido');

  const room = await withTransaction(async (tx) => {
    const previous = await getRoomById(tx, id, { lock: true });
    if (!previous) throw new HttpError(404, 'Habitacion no encontrada');
    assertManualStatusChange(previous, status);

    const note = payload.note === undefined ? previous.note ?? null : requireText(payload.note, 'La nota', 500, { required: false }) || null;
    const updated = await setRoomState(tx, id, status, note);
    await writeAudit(tx, { table: 'Habitaciones', recordId: id, action: 'STATUS_CHANGE', actor, before: previous, after: updated, reason: text(payload.reason) || note });
    return updated;
  });
  sendJson(res, 200, { room });
};

// DELETE /api/rooms/:id (admin): borrado logico, solo si no esta ocupada ni tiene reservas vigentes.
const deleteRoomApi = async ({ req, res, id, actor }) => {
  const payload = await readJson(req);

  await withTransaction(async (tx) => {
    const previous = await getRoomById(tx, id, { lock: true });
    if (!previous) throw new HttpError(404, 'Habitacion no encontrada');
    if (previous.status === 'Ocupada') throw new HttpError(409, 'No se puede eliminar una habitacion ocupada');

    const pending = await tx.request()
      .input('numero', sql.NVarChar(20), previous.number)
      .query(`
        SELECT COUNT(*) AS Total
        FROM dbo.Reservaciones
        WHERE RoomNumber = @numero
          AND IsDeleted = 0
          AND Status <> 'Cancelada'
          AND CheckoutDate >= CONVERT(date, SYSDATETIME())
      `);
    if (pending.recordset[0]?.Total) {
      throw new HttpError(409, 'La habitacion tiene reservas vigentes. Cancelalas o eliminalas primero');
    }

    const deletedBy = actor.username;
    await tx.request()
      .input('id', sql.Int, id)
      .input('deletedBy', sql.NVarChar(100), deletedBy)
      .query(`
        UPDATE dbo.Habitaciones
        SET IsDeleted = 1,
            DeletedAt = SYSDATETIME(),
            DeletedBy = @deletedBy,
            UpdatedAt = SYSDATETIME()
        WHERE Id = @id AND IsDeleted = 0
      `);
    await writeAudit(tx, { table: 'Habitaciones', recordId: id, action: 'DELETE', actor, before: previous, after: { ...previous, isDeleted: true, deletedBy }, reason: text(payload.reason) || 'Eliminacion logica de habitacion' });
  });
  sendJson(res, 200, { ok: true });
};

// ---------------------------------------------------------------------------
// Endpoints: huespedes
// ---------------------------------------------------------------------------

const listGuests = async ({ res }) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT ${GUEST_COLUMNS}
    FROM dbo.Huespedes
    WHERE IsDeleted = 0
    ORDER BY Nombres, Apellidos
  `);
  sendJson(res, 200, { guests: result.recordset.map(mapGuest) });
};

const createGuest = async ({ req, res, actor }) => {
  const payload = await readJson(req);
  const guest = await withTransaction((tx) => saveGuest(tx, payload, actor));
  sendJson(res, 200, { guest });
};

// ---------------------------------------------------------------------------
// Endpoints: reservaciones
// ---------------------------------------------------------------------------

// Lista reservas pendientes de procesar (las procesadas o eliminadas quedan en BD con IsDeleted = 1).
const listReservations = async ({ res }) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT ${RESERVATION_COLUMNS}
    FROM dbo.Reservaciones
    WHERE IsDeleted = 0
    ORDER BY CheckinDate DESC, Id DESC
  `);
  sendJson(res, 200, { reservations: result.recordset.map(mapReservation) });
};

// POST /api/reservations: valida fechas, habitacion existente y cruces con otras reservas.
const createReservation = async ({ req, res, actor }) => {
  const payload = await readJson(req);
  const guest = requireText(payload.guest, 'El huesped', 200);
  const roomNumber = requireText(payload.room, 'La habitacion', 20);
  const status = text(payload.status) || 'Pendiente';
  const clientType = text(payload.clientType) || 'Persona comun';
  const price = payload.price === undefined || payload.price === null || payload.price === '' ? null : Number(payload.price);
  const checkin = text(payload.checkin);
  const checkout = text(payload.checkout);

  if (!validReservationStatuses.has(status)) throw new HttpError(400, 'Estado de reservacion invalido');
  if (!validClientTypes.has(clientType)) throw new HttpError(400, 'Tipo de cliente invalido');
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 9999999999)) {
    throw new HttpError(400, 'El valor de la reservacion no es valido');
  }
  if (!isValidDateText(checkin) || !isValidDateText(checkout)) throw new HttpError(400, 'Las fechas deben tener formato AAAA-MM-DD');
  if (checkout <= checkin) throw new HttpError(400, 'La fecha de salida debe ser posterior a la de entrada');

  const reservation = await withTransaction(async (tx) => {
    const room = await getRoomByNumber(tx, roomNumber, { lock: true });
    if (!room) throw new HttpError(400, `La habitacion ${roomNumber} no existe`);

    // Dos estancias se cruzan si una empieza antes de que termine la otra.
    // Salida y entrada el mismo dia NO es conflicto. Las reservas con llegada ya confirmada tambien cuentan.
    if (status !== 'Cancelada') {
      const processedClause = schemaFeatures.reservationProcessedAt
        ? `OR (IsDeleted = 1 AND ProcessedAt IS NOT NULL)`
        : '';
      const conflict = await tx.request()
        .input('room', sql.NVarChar(20), room.number)
        .input('checkin', sql.NVarChar(10), checkin)
        .input('checkout', sql.NVarChar(10), checkout)
        .query(`
          SELECT TOP 1 Id
          FROM dbo.Reservaciones WITH (UPDLOCK, HOLDLOCK)
          WHERE RoomNumber = @room
            AND Status <> 'Cancelada'
            AND (IsDeleted = 0 ${processedClause})
            AND CheckinDate < CONVERT(date, @checkout, 23)
            AND CheckoutDate > CONVERT(date, @checkin, 23)
        `);
      if (conflict.recordset.length) {
        throw new HttpError(409, 'La habitacion ya tiene una reserva activa en esas fechas');
      }
    }

    const result = await tx.request()
      .input('guest', sql.NVarChar(200), guest)
      .input('room', sql.NVarChar(20), room.number)
      .input('price', sql.Decimal(12, 2), price)
      .input('clientType', sql.NVarChar(30), clientType)
      .input('status', sql.NVarChar(20), status)
      .input('checkin', sql.NVarChar(10), checkin)
      .input('checkout', sql.NVarChar(10), checkout)
      .query(`
        INSERT INTO dbo.Reservaciones (GuestName, RoomNumber, Price, ClientType, Status, CheckinDate, CheckoutDate)
        OUTPUT ${outputColumns(RESERVATION_COLUMNS)}
        VALUES (@guest, @room, @price, @clientType, @status, CONVERT(date, @checkin, 23), CONVERT(date, @checkout, 23))
      `);
    const created = mapReservation(result.recordset[0]);
    await writeAudit(tx, { table: 'Reservaciones', recordId: created.id, action: 'CREATE', actor, before: null, after: created, reason: 'Creacion de reservacion' });
    return created;
  });
  sendJson(res, 201, { reservation });
};

// Marca una reserva como procesada (llegada confirmada o cancelada): sale de la lista activa pero queda en BD.
const markReservationProcessed = async (db, id, status, reason, actor) => {
  const processedColumn = schemaFeatures.reservationProcessedAt ? ', ProcessedAt = SYSDATETIME()' : '';
  const result = await db.request()
    .input('id', sql.Int, id)
    .input('status', sql.NVarChar(20), status)
    .input('reason', sql.NVarChar(500), reason)
    .input('deletedBy', sql.NVarChar(100), actor.username)
    .query(`
      UPDATE dbo.Reservaciones
      SET Status = @status,
          CancellationReason = CASE WHEN @status = 'Cancelada' THEN @reason ELSE CancellationReason END,
          IsDeleted = 1,
          DeletedAt = SYSDATETIME(),
          DeletedBy = @deletedBy,
          UpdatedAt = SYSDATETIME()
          ${processedColumn}
      OUTPUT ${outputColumns(RESERVATION_COLUMNS)}
      WHERE Id = @id AND IsDeleted = 0
    `);
  return mapReservation(result.recordset[0]);
};

// PATCH /api/reservations/:id/status
// - Pendiente: solo cambia el estado (la reserva sigue visible).
// - Confirmada: llegada del huesped. Ocupa la habitacion y crea la entrada para informes.
// - Cancelada: requiere motivo. La reserva se archiva.
const updateReservationStatusApi = async ({ req, res, id, actor }) => {
  const payload = await readJson(req);
  const status = text(payload.status);
  const reason = requireText(payload.reason, 'El motivo', 500, { required: false }) || null;

  if (!validReservationStatuses.has(status)) throw new HttpError(400, 'Estado de reservacion invalido');
  if (status === 'Cancelada' && !reason) throw new HttpError(400, 'El motivo de cancelacion es obligatorio');

  const response = await withTransaction(async (tx) => {
    const previous = await getReservationById(tx, id, { lock: true });
    if (!previous) throw new HttpError(404, 'Reservacion no encontrada');

    if (status === 'Pendiente') {
      const result = await tx.request()
        .input('id', sql.Int, id)
        .query(`
          UPDATE dbo.Reservaciones
          SET Status = 'Pendiente', UpdatedAt = SYSDATETIME()
          OUTPUT ${outputColumns(RESERVATION_COLUMNS)}
          WHERE Id = @id AND IsDeleted = 0
        `);
      const reservation = mapReservation(result.recordset[0]);
      await writeAudit(tx, { table: 'Reservaciones', recordId: id, action: 'STATUS_CHANGE', actor, before: previous, after: reservation, reason });
      return { reservation, room: null, entry: null };
    }

    if (status === 'Cancelada') {
      const reservation = await markReservationProcessed(tx, id, 'Cancelada', reason, actor);
      await writeAudit(tx, { table: 'Reservaciones', recordId: id, action: 'STATUS_CHANGE', actor, before: previous, after: reservation, reason });
      return { reservation, room: null, entry: null };
    }

    // Confirmada: llegada del huesped.
    if (previous.status === 'Cancelada') {
      throw new HttpError(409, 'No se puede confirmar la llegada de una reservacion cancelada');
    }

    const previousRoom = await getRoomByNumber(tx, previous.room, { lock: true });
    if (!previousRoom) throw new HttpError(409, `La habitacion ${previous.room} ya no existe`);
    if (previousRoom.status === 'Ocupada') {
      throw new HttpError(409, `La habitacion ${previousRoom.number} esta ocupada. Liberala antes de confirmar la llegada`);
    }
    if (previousRoom.status === 'Mantenimiento') {
      throw new HttpError(409, `La habitacion ${previousRoom.number} esta en mantenimiento. Pasala a Disponible antes de confirmar la llegada`);
    }

    const reservation = await markReservationProcessed(tx, id, 'Confirmada', null, actor);
    await writeAudit(tx, { table: 'Reservaciones', recordId: id, action: 'STATUS_CHANGE', actor, before: previous, after: reservation, reason: 'Llegada confirmada' });

    const clientType = previous.clientType || 'Persona comun';
    const price = previous.price ?? 0;
    const entry = await insertOccupancyEntry(tx, { room: previousRoom, guestId: null, guestName: previous.guest, price, clientType });
    await writeAudit(tx, { table: 'EntradasOcupacion', recordId: entry.id, action: 'CREATE', actor, before: null, after: entry, reason: 'Llegada confirmada desde reservacion' });

    const room = await setRoomState(tx, previousRoom.id, 'Ocupada', `Ocupada por ${previous.guest} - ${clientType} - Valor: $${price}`);
    await writeAudit(tx, { table: 'Habitaciones', recordId: room.id, action: 'STATUS_CHANGE', actor, before: previousRoom, after: room, reason: 'Llegada confirmada desde reservacion' });

    return { reservation, room, entry };
  });

  sendJson(res, 200, response);
};

// DELETE /api/reservations/:id: borrado logico con auditoria.
const deleteReservationApi = async ({ req, res, id, actor }) => {
  const payload = await readJson(req);

  await withTransaction(async (tx) => {
    const previous = await getReservationById(tx, id, { lock: true });
    if (!previous) throw new HttpError(404, 'Reservacion no encontrada');

    const deletedBy = actor.username;
    await tx.request()
      .input('id', sql.Int, id)
      .input('deletedBy', sql.NVarChar(100), deletedBy)
      .query(`
        UPDATE dbo.Reservaciones
        SET IsDeleted = 1,
            DeletedAt = SYSDATETIME(),
            DeletedBy = @deletedBy,
            UpdatedAt = SYSDATETIME()
        WHERE Id = @id AND IsDeleted = 0
      `);
    await writeAudit(tx, { table: 'Reservaciones', recordId: id, action: 'DELETE', actor, before: previous, after: { ...previous, isDeleted: true, deletedBy }, reason: text(payload.reason) || 'Eliminacion logica de reservacion' });
  });
  sendJson(res, 200, { ok: true });
};

// ---------------------------------------------------------------------------
// Endpoints: ocupaciones
// ---------------------------------------------------------------------------

const listOccupancyEntries = async ({ res }) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT ${OCCUPANCY_COLUMNS}
    FROM dbo.EntradasOcupacion
    ORDER BY EntryDate DESC, Id DESC
  `);
  sendJson(res, 200, { occupancyEntries: result.recordset.map(mapOccupancyEntry) });
};

// POST /api/occupancy: ocupa una habitacion libre, guarda el huesped y crea la entrada.
const createOccupancy = async ({ req, res, actor }) => {
  const payload = await readJson(req);
  const roomId = Number(payload.roomId);
  const price = Number(payload.price);
  const clientType = text(payload.clientType);

  if (!Number.isInteger(roomId) || roomId <= 0) throw new HttpError(400, 'Habitacion invalida');
  if (!Number.isFinite(price) || price <= 0 || price > 9999999999) throw new HttpError(400, 'El valor debe ser mayor a cero');
  if (!validClientTypes.has(clientType)) throw new HttpError(400, 'Tipo de cliente invalido');

  const response = await withTransaction(async (tx) => {
    const previousRoom = await getRoomById(tx, roomId, { lock: true });
    if (!previousRoom) throw new HttpError(404, 'Habitacion no encontrada');
    if (previousRoom.status === 'Ocupada') throw new HttpError(409, `La habitacion ${previousRoom.number} ya esta ocupada`);
    if (previousRoom.status === 'Mantenimiento') throw new HttpError(409, `La habitacion ${previousRoom.number} esta en mantenimiento. Cambiala a Disponible primero`);

    const guest = await saveGuest(tx, payload.guest || {}, actor);
    const guestName = `${guest.nombres} ${guest.apellidos}`;

    const entry = await insertOccupancyEntry(tx, { room: previousRoom, guestId: guest.id, guestName, price, clientType });
    await writeAudit(tx, { table: 'EntradasOcupacion', recordId: entry.id, action: 'CREATE', actor, before: null, after: entry, reason: 'Ocupacion registrada' });

    const room = await setRoomState(tx, roomId, 'Ocupada', `Ocupada por ${guestName} - ${clientType} - Valor: $${price}`);
    await writeAudit(tx, { table: 'Habitaciones', recordId: room.id, action: 'STATUS_CHANGE', actor, before: previousRoom, after: room, reason: 'Ocupacion registrada' });

    return { room, guest, entry };
  });
  sendJson(res, 201, response);
};

// PATCH /api/occupancy/room/:roomId/cancel: anula la entrada de la estancia actual y libera la habitacion.
const cancelOccupancyByRoom = async ({ req, res, id: roomId, actor }) => {
  const payload = await readJson(req);
  const reason = requireText(payload.reason, 'El motivo de cancelacion', 500);

  const response = await withTransaction(async (tx) => {
    const previousRoom = await getRoomById(tx, roomId, { lock: true });
    if (!previousRoom) throw new HttpError(404, 'Habitacion no encontrada');
    if (previousRoom.status !== 'Ocupada') throw new HttpError(409, 'La habitacion no esta ocupada');

    // Solo se cancela la entrada mas reciente de la habitacion (la de la estancia actual),
    // nunca una entrada antigua de un huesped que ya salio.
    const latest = await tx.request()
      .input('roomId', sql.Int, roomId)
      .query(`
        SELECT TOP 1 ${OCCUPANCY_COLUMNS}
        FROM dbo.EntradasOcupacion WITH (UPDLOCK, HOLDLOCK)
        WHERE RoomId = @roomId
        ORDER BY Id DESC
      `);
    const previousEntry = latest.recordset.length ? mapOccupancyEntry(latest.recordset[0]) : null;
    let entry = null;

    if (previousEntry && previousEntry.status === 'Activa') {
      const entryResult = await tx.request()
        .input('id', sql.Int, previousEntry.id)
        .input('reason', sql.NVarChar(500), reason)
        .query(`
          UPDATE dbo.EntradasOcupacion
          SET Status = 'Cancelada',
              CancellationReason = @reason,
              CanceledAt = CONVERT(date, SYSDATETIME()),
              UpdatedAt = SYSDATETIME()
          OUTPUT ${outputColumns(OCCUPANCY_COLUMNS)}
          WHERE Id = @id AND Status = 'Activa'
        `);
      entry = mapOccupancyEntry(entryResult.recordset[0]);
      await writeAudit(tx, { table: 'EntradasOcupacion', recordId: entry.id, action: 'STATUS_CHANGE', actor, before: previousEntry, after: entry, reason });
    }

    const room = await setRoomState(tx, roomId, 'Disponible', `Entrada cancelada: ${reason}`);
    await writeAudit(tx, { table: 'Habitaciones', recordId: room.id, action: 'STATUS_CHANGE', actor, before: previousRoom, after: room, reason });
    return { room, entry };
  });
  sendJson(res, 200, response);
};

// ---------------------------------------------------------------------------
// Endpoints: configuracion del sistema
// ---------------------------------------------------------------------------

const SETTING_KEYS = ['notifications', 'maintenanceMode', 'alertLowStock'];
const DEFAULT_SETTINGS = { notifications: true, maintenanceMode: false, alertLowStock: true };

const readSettingsFromDb = async (db) => {
  if (!schemaFeatures.settingsTable) return { ...DEFAULT_SETTINGS };
  const result = await db.request().query(`
    SELECT Clave, Valor
    FROM dbo.Configuracion
    WHERE Clave IN ('notifications', 'maintenanceMode', 'alertLowStock')
  `);
  const settings = { ...DEFAULT_SETTINGS };
  for (const row of result.recordset) {
    if (SETTING_KEYS.includes(row.Clave)) {
      settings[row.Clave] = String(row.Valor).toLowerCase() === 'true';
    }
  }
  return settings;
};

const getSettingsApi = async ({ res }) => {
  const pool = await getPool();
  const settings = await readSettingsFromDb(pool);
  sendJson(res, 200, { settings });
};

const updateSettingsApi = async ({ req, res, actor }) => {
  const payload = await readJson(req);
  for (const key of SETTING_KEYS) {
    if (payload[key] !== undefined && typeof payload[key] !== 'boolean') {
      throw new HttpError(400, `El parametro ${key} debe ser booleano`);
    }
  }

  const settings = await withTransaction(async (tx) => {
    const previous = await readSettingsFromDb(tx);
    const next = {
      notifications: payload.notifications ?? previous.notifications,
      maintenanceMode: payload.maintenanceMode ?? previous.maintenanceMode,
      alertLowStock: payload.alertLowStock ?? previous.alertLowStock
    };

    for (const key of SETTING_KEYS) {
      await tx.request()
        .input('clave', sql.NVarChar(100), key)
        .input('valor', sql.NVarChar(500), String(next[key]))
        .input('updatedBy', sql.NVarChar(100), actor.username)
        .query(`
          MERGE dbo.Configuracion AS target
          USING (SELECT @clave AS Clave) AS source
          ON target.Clave = source.Clave
          WHEN MATCHED THEN
            UPDATE SET Valor = @valor, UpdatedAt = SYSDATETIME(), UpdatedBy = @updatedBy
          WHEN NOT MATCHED THEN
            INSERT (Clave, Valor, UpdatedBy) VALUES (@clave, @valor, @updatedBy);
        `);
    }

    await writeAudit(tx, {
      table: 'Configuracion',
      recordId: null,
      action: 'UPDATE',
      actor,
      before: previous,
      after: next,
      reason: 'Actualizacion de preferencias del sistema'
    });
    return next;
  });

  sendJson(res, 200, { settings });
};

// ---------------------------------------------------------------------------
// Endpoints: auditoria (solo admin)
// ---------------------------------------------------------------------------

const listAudit = async ({ res, url }) => {
  const table = text(url.searchParams.get('table'));
  const recordId = Number(url.searchParams.get('recordId'));
  const requestedLimit = Number(url.searchParams.get('limit'));
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 500) : 100;

  const pool = await getPool();
  const request = pool.request().input('limit', sql.Int, limit);
  const filters = [];

  if (table) {
    request.input('table', sql.NVarChar(100), table);
    filters.push('Tabla = @table');
  }
  if (Number.isInteger(recordId) && recordId > 0) {
    request.input('recordId', sql.Int, recordId);
    filters.push('RegistroId = @recordId');
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const result = await request.query(`
    SELECT TOP (@limit) Id, Tabla, RegistroId, Accion, UsuarioId, UsuarioNombre, DatosAnteriores, DatosNuevos, Motivo, CreatedAt
    FROM dbo.Auditoria
    ${where}
    ORDER BY CreatedAt DESC
  `);
  sendJson(res, 200, { audit: result.recordset });
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const ANY_ROLE = ['admin', 'trabajador'];
const ADMIN = ['admin'];

// roles: null = publica; lista = requiere sesion con alguno de esos roles.
const routes = [
  { method: 'GET', pattern: /^\/api\/health$/, roles: null, handler: health },
  { method: 'POST', pattern: /^\/api\/auth\/login$/, roles: null, handler: login },
  { method: 'GET', pattern: /^\/api\/auth\/me$/, roles: ANY_ROLE, handler: me },

  { method: 'GET', pattern: /^\/api\/users$/, roles: ADMIN, handler: listUsers },
  { method: 'POST', pattern: /^\/api\/users$/, roles: ADMIN, handler: createUser },
  { method: 'PUT', pattern: /^\/api\/users\/(\d+)$/, roles: ADMIN, handler: updateUser },
  { method: 'PATCH', pattern: /^\/api\/users\/(\d+)$/, roles: ADMIN, handler: toggleUserStatus },
  { method: 'DELETE', pattern: /^\/api\/users\/(\d+)$/, roles: ADMIN, handler: deleteUser },

  { method: 'GET', pattern: /^\/api\/rooms$/, roles: ANY_ROLE, handler: listRooms },
  { method: 'POST', pattern: /^\/api\/rooms$/, roles: ADMIN, handler: createRoom },
  { method: 'PUT', pattern: /^\/api\/rooms\/(\d+)$/, roles: ADMIN, handler: updateRoom },
  { method: 'DELETE', pattern: /^\/api\/rooms\/(\d+)$/, roles: ADMIN, handler: deleteRoomApi },
  { method: 'PATCH', pattern: /^\/api\/rooms\/(\d+)\/status$/, roles: ANY_ROLE, handler: updateRoomStatusApi },

  { method: 'GET', pattern: /^\/api\/guests$/, roles: ANY_ROLE, handler: listGuests },
  { method: 'POST', pattern: /^\/api\/guests$/, roles: ANY_ROLE, handler: createGuest },

  { method: 'GET', pattern: /^\/api\/reservations$/, roles: ANY_ROLE, handler: listReservations },
  { method: 'POST', pattern: /^\/api\/reservations$/, roles: ANY_ROLE, handler: createReservation },
  { method: 'DELETE', pattern: /^\/api\/reservations\/(\d+)$/, roles: ANY_ROLE, handler: deleteReservationApi },
  { method: 'PATCH', pattern: /^\/api\/reservations\/(\d+)\/status$/, roles: ANY_ROLE, handler: updateReservationStatusApi },

  { method: 'GET', pattern: /^\/api\/occupancy$/, roles: ANY_ROLE, handler: listOccupancyEntries },
  { method: 'POST', pattern: /^\/api\/occupancy$/, roles: ANY_ROLE, handler: createOccupancy },
  { method: 'PATCH', pattern: /^\/api\/occupancy\/room\/(\d+)\/cancel$/, roles: ANY_ROLE, handler: cancelOccupancyByRoom },

  { method: 'GET', pattern: /^\/api\/settings$/, roles: ANY_ROLE, handler: getSettingsApi },
  { method: 'PUT', pattern: /^\/api\/settings$/, roles: ADMIN, handler: updateSettingsApi },

  { method: 'GET', pattern: /^\/api\/audit$/, roles: ADMIN, handler: listAudit }
];

const isDbConnectionError = (error) =>
  error instanceof sql.ConnectionError ||
  ['ESOCKET', 'ETIMEOUT', 'ELOGIN', 'EINSTLOOKUP', 'ECONNCLOSED', 'ENOTOPEN'].includes(error?.code);

// Traduce errores a respuestas seguras: nunca se envian detalles internos de SQL al cliente.
const handleError = (res, error) => {
  if (res.headersSent) {
    res.end();
    return;
  }
  if (error instanceof HttpError) {
    sendJson(res, error.status, { error: error.message });
    return;
  }
  if (isDuplicateKeyError(error)) {
    sendJson(res, 409, { error: 'Ya existe un registro con esos datos' });
    return;
  }
  if (error?.number === 547) {
    sendJson(res, 409, { error: 'Los datos no cumplen las reglas de la base de datos' });
    return;
  }
  if (error?.number === 8152 || error?.number === 2628) {
    sendJson(res, 400, { error: 'Algun campo supera la longitud permitida' });
    return;
  }

  console.error('[API]', error);
  if (isDbConnectionError(error)) {
    resetPool();
    sendJson(res, 503, { error: 'Base de datos no disponible. Intenta de nuevo en unos minutos.' });
    return;
  }
  sendJson(res, 500, { error: 'Error interno del servidor' });
};

// ---------------------------------------------------------------------------
// Frontend compilado (dist/) opcional
// ---------------------------------------------------------------------------

const distDir = path.resolve(__dirname, '..', 'dist');
const serveFrontend = process.env.SERVE_FRONTEND !== 'false' && fs.existsSync(path.join(distDir, 'index.html'));
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// Sirve archivos de dist/ con proteccion contra path traversal. Rutas desconocidas -> index.html (SPA).
const serveStatic = (req, res, pathname) => {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = '/';
  }
  let filePath = path.resolve(distDir, `.${decoded}`);
  if (!filePath.startsWith(distDir + path.sep) && filePath !== distDir) filePath = path.join(distDir, 'index.html');
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(distDir, 'index.html');

  const ext = path.extname(filePath).toLowerCase();
  const isAsset = filePath.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...securityHeaders
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
};

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || '/', 'http://localhost');

    if (!url.pathname.startsWith('/api/')) {
      if (serveFrontend && (req.method === 'GET' || req.method === 'HEAD')) {
        serveStatic(req, res, url.pathname);
        return;
      }
      sendJson(res, 404, { error: 'Ruta no encontrada' });
      return;
    }

    const route = routes.find((item) => item.method === req.method && item.pattern.test(url.pathname));
    if (!route) {
      const pathExists = routes.some((item) => item.pattern.test(url.pathname));
      sendJson(res, pathExists ? 405 : 404, { error: pathExists ? 'Metodo no permitido' : 'Ruta no encontrada' });
      return;
    }

    const match = url.pathname.match(route.pattern);
    const id = match && match[1] ? Number(match[1]) : undefined;

    let user = null;
    if (route.roles) {
      user = await authenticate(req);
      if (!route.roles.includes(user.role)) throw new HttpError(403, 'No tienes permisos para esta accion');
    }

    await route.handler({
      req,
      res,
      url,
      id,
      user,
      actor: user ? { userId: String(user.id), username: user.username } : null
    });
  } catch (error) {
    handleError(res, error);
  }
});

server.listen(PORT, () => {
  const target = dbClient === 'tedious' ? `${dbConfig.server}${dbConfig.port ? `:${dbConfig.port}` : ''}` : dbConfig.server;
  console.log(`Backend Hotel (${dbClient}) -> ${target}/${sqlDatabase}`);
  console.log(`Backend Hotel escuchando en http://localhost:${PORT}`);
  if (serveFrontend) console.log(`Sirviendo frontend compilado desde ${distDir}`);
  if (!allowedOrigins.length) console.log('CORS desactivado (solo mismo origen). Usa CORS_ORIGIN si el frontend esta en otro dominio.');
});

const shutdown = async () => {
  server.close(async () => {
    try {
      if (poolPromise) {
        const pool = await poolPromise;
        await pool.close();
      }
    } catch {
      // Ignora errores al cerrar el pool en apagado.
    }
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
