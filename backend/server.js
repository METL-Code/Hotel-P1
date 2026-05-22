// Servidor API del hotel.
// Se ejecuta con npm run api y atiende login/usuarios en http://localhost:4000.
import fs from 'fs';
import http from 'http';
import path from 'path';
import sql from 'mssql/msnodesqlv8.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lee backend/.env para configurar SQL Server sin escribir datos sensibles en el codigo.
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

// Puerto donde escucha la API. Vite redirige /api hacia este puerto.
const PORT = Number(process.env.API_PORT || 4000);
const dbConnectionTimeoutMs = Number(process.env.DB_CONNECTION_TIMEOUT || 5000);
const dbRequestTimeoutMs = Number(process.env.DB_REQUEST_TIMEOUT || 8000);
const dbConnectionTimeoutSeconds = Math.max(1, Math.ceil(dbConnectionTimeoutMs / 1000));
// Nombre del servidor o instancia SQL Server usado para conectar la base HotelDB.
const sqlServer = process.env.DB_INSTANCE
  ? `${process.env.DB_SERVER || 'DESKTOP-NSUD4A7'}\\${process.env.DB_INSTANCE}`
  : process.env.DB_SERVER || 'DESKTOP-NSUD4A7';
const sqlDatabase = process.env.DB_DATABASE || 'HotelDB';
const sqlUser = process.env.DB_USER || '';
const sqlPassword = process.env.DB_PASSWORD || '';
const useSqlAuthentication = Boolean(sqlUser && sqlPassword);

// Configuracion completa para msnodesqlv8/mssql.
// Si DB_USER y DB_PASSWORD existen, usa SQL Server Authentication; si no, usa Windows Authentication.
const dbConfig = {
  connectionString: [
    `Driver={${process.env.DB_DRIVER || 'ODBC Driver 17 for SQL Server'}}`,
    `Server=${sqlServer}`,
    `Database=${sqlDatabase}`,
    useSqlAuthentication ? `UID=${sqlUser}` : 'Trusted_Connection=Yes',
    useSqlAuthentication ? `PWD=${sqlPassword}` : '',
    `Connection Timeout=${dbConnectionTimeoutSeconds}`,
    `Encrypt=${process.env.DB_ENCRYPT === 'true' ? 'Yes' : 'No'}`,
    process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' ? 'TrustServerCertificate=Yes' : '',
    process.env.DB_EXTRA || ''
  ].filter(Boolean).join(';'),
  server: sqlServer,
  database: sqlDatabase,
  user: useSqlAuthentication ? sqlUser : undefined,
  password: useSqlAuthentication ? sqlPassword : undefined,
  driver: 'msnodesqlv8',
  connectionTimeout: dbConnectionTimeoutMs,
  requestTimeout: dbRequestTimeoutMs,
  options: {
    trustedConnection: !useSqlAuthentication && process.env.DB_TRUSTED_CONNECTION !== 'false',
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false'
  }
};

// Pool compartido de conexion a SQL Server para no abrir una conexion por cada request.
let poolPromise;

// Devuelve el pool de SQL. Si falla, limpia poolPromise para permitir otro intento.
const getPool = async () => {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig).connect().catch((error) => {
      poolPromise = undefined;
      throw error;
    });
  }
  return poolPromise;
};

// Lee y convierte el body JSON enviado por el frontend.
const readJson = (req) => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    try {
      resolve(body ? JSON.parse(body) : {});
    } catch {
      reject(new Error('JSON invalido'));
    }
  });
});

// Responde siempre JSON y habilita CORS para pruebas locales.
const sendJson = (res, status, payload) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Username, X-User-Role'
  });
  res.end(JSON.stringify(payload));
};

// Convierte columnas de SQL Server al modelo que usa el frontend.
const mapUser = (row) => ({
  id: row.Id,
  nombres: row.Nombres,
  apellidos: row.Apellidos,
  username: row.Username,
  email: row.Email,
  password: row.Password,
  role: row.Role,
  status: row.Status
});

// Devuelve solo datos seguros del usuario logueado al frontend.
const publicUser = (user) => ({
  id: String(user.id),
  username: user.username,
  email: user.email,
  role: user.role
});
// Estados validos de habitacion que aceptan backend y base de datos.
const validRoomStatuses = new Set(['Disponible', 'Ocupada', 'Mantenimiento']);

// Convierte columnas de dbo.Habitaciones al modelo Room usado por React.
const mapRoom = (row) => ({
  id: row.Id,
  number: row.Numero,
  type: row.Tipo,
  status: row.Estado,
  note: row.Nota || undefined
});

// Lee informacion del usuario desde headers enviados por el frontend para auditoria.
const getActor = (req) => ({
  userId: req.headers['x-user-id'] ? String(req.headers['x-user-id']) : null,
  username: req.headers['x-username'] ? String(req.headers['x-username']) : 'Sistema'
});

// Guarda una fila de auditoria con datos anteriores/nuevos en JSON.
const writeAudit = async (pool, { table, recordId, action, actor, before, after, reason }) => {
  await pool.request()
    .input('tabla', sql.NVarChar(100), table)
    .input('registroId', sql.Int, recordId ?? null)
    .input('accion', sql.NVarChar(50), action)
    .input('usuarioId', sql.NVarChar(50), actor?.userId ?? null)
    .input('usuarioNombre', sql.NVarChar(150), actor?.username ?? 'Sistema')
    .input('datosAnteriores', sql.NVarChar(sql.MAX), before ? JSON.stringify(before) : null)
    .input('datosNuevos', sql.NVarChar(sql.MAX), after ? JSON.stringify(after) : null)
    .input('motivo', sql.NVarChar(500), reason || null)
    .query(`
      INSERT INTO dbo.Auditoria (Tabla, RegistroId, Accion, UsuarioId, UsuarioNombre, DatosAnteriores, DatosNuevos, Motivo)
      VALUES (@tabla, @registroId, @accion, @usuarioId, @usuarioNombre, @datosAnteriores, @datosNuevos, @motivo)
    `);
};

// Busca una habitacion activa por Id. Se usa antes de actualizar/eliminar para auditar el estado anterior.
const getRoomById = async (pool, id) => {
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(`
      SELECT Id, Numero, Tipo, Estado, Nota
      FROM dbo.Habitaciones
      WHERE Id = @id AND IsDeleted = 0
    `);

  return result.recordset.length ? mapRoom(result.recordset[0]) : null;
};

// Estados validos de reserva que aceptan backend y base de datos.
const validReservationStatuses = new Set(['Confirmada', 'Pendiente', 'Cancelada']);
// Tipos de cliente validos para reservas y ocupaciones.
const validClientTypes = new Set(['Persona comun', 'Persona recurrente']);

// Convierte fechas de SQL Server o strings al formato YYYY-MM-DD usado por React.
const toDateValue = (value) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Convierte columnas de dbo.Huespedes al modelo Guest usado por React.
const mapGuest = (row) => ({
  id: row.Id,
  cedula: row.Cedula,
  nombres: row.Nombres,
  apellidos: row.Apellidos,
  email: row.Email || undefined
});

// Convierte columnas de dbo.Reservaciones al modelo Reservation usado por React.
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

// Convierte columnas de dbo.EntradasOcupacion al modelo OccupancyEntry usado por informes.
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

// Busca un usuario activo por Id para auditar cambios antes de modificarlos.
const getUserById = async (pool, id) => {
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(`
      SELECT Id, Nombres, Apellidos, Username, Email, Password, Role, Status
      FROM dbo.Usuarios
      WHERE Id = @id AND IsDeleted = 0
    `);

  return result.recordset.length ? mapUser(result.recordset[0]) : null;
};

// Busca una habitacion activa por numero, util para procesar reservaciones.
const getRoomByNumber = async (pool, number) => {
  const result = await pool.request()
    .input('numero', sql.NVarChar(20), number)
    .query(`
      SELECT Id, Numero, Tipo, Estado, Nota
      FROM dbo.Habitaciones
      WHERE Numero = @numero AND IsDeleted = 0
    `);

  return result.recordset.length ? mapRoom(result.recordset[0]) : null;
};

// Busca una reservacion activa por Id para auditar y procesar llegada/cancelacion.
const getReservationById = async (pool, id) => {
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(`
      SELECT Id, GuestName, RoomNumber, Price, ClientType, Status, CheckinDate, CheckoutDate, CancellationReason
      FROM dbo.Reservaciones
      WHERE Id = @id AND IsDeleted = 0
    `);

  return result.recordset.length ? mapReservation(result.recordset[0]) : null;
};

// Busca la entrada activa mas reciente de una habitacion para poder cancelarla.
const getActiveOccupancyByRoom = async (pool, roomId) => {
  const result = await pool.request()
    .input('roomId', sql.Int, roomId)
    .query(`
      SELECT TOP 1 Id, RoomId, RoomNumber, GuestId, GuestName, Price, ClientType, EntryDate, Status, CancellationReason, CanceledAt
      FROM dbo.EntradasOcupacion
      WHERE RoomId = @roomId AND Status = 'Activa'
      ORDER BY Id DESC
    `);

  return result.recordset.length ? mapOccupancyEntry(result.recordset[0]) : null;
};

// Crea o actualiza un huesped por cedula y devuelve el registro listo para React.
const saveGuest = async (pool, payload, actor) => {
  const cedula = String(payload.cedula || '').trim();
  const nombres = String(payload.nombres || '').trim();
  const apellidos = String(payload.apellidos || '').trim();
  const email = payload.email ? String(payload.email).trim() : null;

  const previousResult = await pool.request()
    .input('cedula', sql.NVarChar(50), cedula)
    .query(`
      SELECT Id, Cedula, Nombres, Apellidos, Email
      FROM dbo.Huespedes
      WHERE Cedula = @cedula AND IsDeleted = 0
    `);

  if (previousResult.recordset.length) {
    const previous = mapGuest(previousResult.recordset[0]);
    const result = await pool.request()
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
        OUTPUT inserted.Id, inserted.Cedula, inserted.Nombres, inserted.Apellidos, inserted.Email
        WHERE Id = @id AND IsDeleted = 0
      `);

    const guest = mapGuest(result.recordset[0]);
    await writeAudit(pool, { table: 'Huespedes', recordId: guest.id, action: 'UPDATE', actor, before: previous, after: guest, reason: 'Actualizacion de huesped' });
    return guest;
  }

  const result = await pool.request()
    .input('cedula', sql.NVarChar(50), cedula)
    .input('nombres', sql.NVarChar(100), nombres)
    .input('apellidos', sql.NVarChar(100), apellidos)
    .input('email', sql.NVarChar(150), email)
    .query(`
      INSERT INTO dbo.Huespedes (Cedula, Nombres, Apellidos, Email)
      OUTPUT inserted.Id, inserted.Cedula, inserted.Nombres, inserted.Apellidos, inserted.Email
      VALUES (@cedula, @nombres, @apellidos, @email)
    `);

  const guest = mapGuest(result.recordset[0]);
  await writeAudit(pool, { table: 'Huespedes', recordId: guest.id, action: 'CREATE', actor, before: null, after: guest, reason: 'Creacion de huesped' });
  return guest;
};

// Endpoint POST /api/auth/login.
// Se ve cuando LoginPage envia usuario, clave y rol para iniciar sesion.
const login = async (req, res) => {
  const { username, password, role } = await readJson(req);
  const pool = await getPool();
  const result = await pool.request()
    .input('username', sql.NVarChar(100), String(username || '').trim())
    .input('role', sql.NVarChar(20), role)
    .query(`
      SELECT TOP 1 Id, Nombres, Apellidos, Username, Email, Password, Role, Status
      FROM dbo.Usuarios
      WHERE Username = @username AND Role = @role AND IsDeleted = 0
    `);

  if (!result.recordset.length) {
    sendJson(res, 401, { error: 'Usuario o contrasena incorrectos' });
    return;
  }

  const user = mapUser(result.recordset[0]);

  if (user.password !== password) {
    sendJson(res, 401, { error: 'Usuario o contrasena incorrectos' });
    return;
  }

  if (user.status !== 'Activo') {
    sendJson(res, 403, { error: 'Este usuario esta inactivo' });
    return;
  }

  sendJson(res, 200, { user: publicUser(user) });
};

// Endpoint GET /api/users.
// Se ve en la pantalla Usuarios cuando la API esta activada.
const listUsers = async (_req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT Id, Nombres, Apellidos, Username, Email, Password, Role, Status
    FROM dbo.Usuarios
    WHERE IsDeleted = 0
    ORDER BY Id
  `);
  sendJson(res, 200, { users: result.recordset.map(mapUser) });
};

// Endpoint POST /api/users.
// Crea usuarios desde la pantalla Usuarios.
const createUser = async (req, res) => {
  const payload = await readJson(req);
  const actor = getActor(req);
  const username = String(payload.username || '').trim();
  const email = String(payload.email || '').trim();

  if (!payload.nombres || !payload.apellidos || !username || !email || !payload.password || !payload.role) {
    sendJson(res, 400, { error: 'Faltan datos obligatorios' });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('nombres', sql.NVarChar(100), String(payload.nombres).trim())
      .input('apellidos', sql.NVarChar(100), String(payload.apellidos).trim())
      .input('username', sql.NVarChar(100), username)
      .input('email', sql.NVarChar(150), email)
      .input('password', sql.NVarChar(255), String(payload.password))
      .input('role', sql.NVarChar(20), payload.role)
      .query(`
        INSERT INTO dbo.Usuarios (Nombres, Apellidos, Username, Email, Password, Role, Status)
        OUTPUT inserted.Id, inserted.Nombres, inserted.Apellidos, inserted.Username, inserted.Email, inserted.Password, inserted.Role, inserted.Status
        VALUES (@nombres, @apellidos, @username, @email, @password, @role, 'Activo')
      `);

    const user = mapUser(result.recordset[0]);
    await writeAudit(pool, { table: 'Usuarios', recordId: user.id, action: 'CREATE', actor, before: null, after: user, reason: 'Creacion de usuario' });
    sendJson(res, 201, { user });
  } catch (error) {
    if (error?.number === 2627 || error?.number === 2601) {
      sendJson(res, 409, { error: 'Ya existe un usuario con ese usuario o email' });
      return;
    }
    throw error;
  }
};

// Endpoint PUT /api/users/:id.
// Actualiza datos de un usuario existente.
const updateUser = async (req, res, id) => {
  const payload = await readJson(req);
  const actor = getActor(req);
  const username = String(payload.username || '').trim();
  const email = String(payload.email || '').trim();

  if (!payload.nombres || !payload.apellidos || !username || !email || !payload.role) {
    sendJson(res, 400, { error: 'Faltan datos obligatorios' });
    return;
  }

  try {
    const pool = await getPool();
    const previous = await getUserById(pool, id);

    if (!previous) {
      sendJson(res, 404, { error: 'Usuario no encontrado' });
      return;
    }

    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('nombres', sql.NVarChar(100), String(payload.nombres).trim())
      .input('apellidos', sql.NVarChar(100), String(payload.apellidos).trim())
      .input('username', sql.NVarChar(100), username)
      .input('email', sql.NVarChar(150), email)
      .input('role', sql.NVarChar(20), payload.role)
      .query(`
        UPDATE dbo.Usuarios
        SET Nombres = @nombres,
            Apellidos = @apellidos,
            Username = @username,
            Email = @email,
            Role = @role,
            UpdatedAt = SYSDATETIME()
        OUTPUT inserted.Id, inserted.Nombres, inserted.Apellidos, inserted.Username, inserted.Email, inserted.Password, inserted.Role, inserted.Status
        WHERE Id = @id AND IsDeleted = 0
      `);

    const user = mapUser(result.recordset[0]);
    await writeAudit(pool, { table: 'Usuarios', recordId: id, action: 'UPDATE', actor, before: previous, after: user, reason: payload.reason || 'Actualizacion de usuario' });
    sendJson(res, 200, { user });
  } catch (error) {
    if (error?.number === 2627 || error?.number === 2601) {
      sendJson(res, 409, { error: 'Ya existe un usuario con ese usuario o email' });
      return;
    }
    throw error;
  }
};

// Endpoint PATCH /api/users/:id.
// Alterna el estado Activo/Inactivo desde la tabla de usuarios.
const toggleUserStatus = async (req, res, id) => {
  const actor = getActor(req);
  const pool = await getPool();
  const previous = await getUserById(pool, id);

  if (!previous) {
    sendJson(res, 404, { error: 'Usuario no encontrado' });
    return;
  }

  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(`
      UPDATE dbo.Usuarios
      SET Status = CASE WHEN Status = 'Activo' THEN 'Inactivo' ELSE 'Activo' END,
          UpdatedAt = SYSDATETIME()
      OUTPUT inserted.Id, inserted.Nombres, inserted.Apellidos, inserted.Username, inserted.Email, inserted.Password, inserted.Role, inserted.Status
      WHERE Id = @id AND IsDeleted = 0
    `);

  const user = mapUser(result.recordset[0]);
  await writeAudit(pool, { table: 'Usuarios', recordId: id, action: 'STATUS_CHANGE', actor, before: previous, after: user, reason: 'Cambio de estado de usuario' });
  sendJson(res, 200, { user });
};


// Endpoint GET /api/rooms.
// Devuelve habitaciones activas desde SQL Server para Dashboard y Habitaciones.
const listRooms = async (_req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT Id, Numero, Tipo, Estado, Nota
    FROM dbo.Habitaciones
    WHERE IsDeleted = 0
    ORDER BY Numero
  `);

  sendJson(res, 200, { rooms: result.recordset.map(mapRoom) });
};

// Endpoint POST /api/rooms.
// Crea una habitacion en SQL y registra auditoria CREATE.
const createRoom = async (req, res) => {
  const payload = await readJson(req);
  const actor = getActor(req);
  const number = String(payload.number || '').trim();
  const type = String(payload.type || '').trim();
  const status = String(payload.status || 'Disponible').trim();
  const note = payload.note ? String(payload.note).trim() : null;

  if (!number || !type || !validRoomStatuses.has(status)) {
    sendJson(res, 400, { error: 'Numero, tipo y estado valido son obligatorios' });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('numero', sql.NVarChar(20), number)
      .input('tipo', sql.NVarChar(50), type)
      .input('estado', sql.NVarChar(30), status)
      .input('nota', sql.NVarChar(500), note)
      .query(`
        INSERT INTO dbo.Habitaciones (Numero, Tipo, Estado, Nota)
        OUTPUT inserted.Id, inserted.Numero, inserted.Tipo, inserted.Estado, inserted.Nota
        VALUES (@numero, @tipo, @estado, @nota)
      `);

    const room = mapRoom(result.recordset[0]);
    await writeAudit(pool, { table: 'Habitaciones', recordId: room.id, action: 'CREATE', actor, before: null, after: room, reason: 'Creacion de habitacion' });
    sendJson(res, 201, { room });
  } catch (error) {
    if (error?.number === 2627 || error?.number === 2601) {
      sendJson(res, 409, { error: 'Ya existe una habitacion con ese numero' });
      return;
    }
    throw error;
  }
};

// Endpoint PUT /api/rooms/:id.
// Actualiza numero/tipo/estado/nota y registra auditoria UPDATE.
const updateRoom = async (req, res, id) => {
  const payload = await readJson(req);
  const actor = getActor(req);
  const pool = await getPool();
  const previous = await getRoomById(pool, id);

  if (!previous) {
    sendJson(res, 404, { error: 'Habitacion no encontrada' });
    return;
  }

  const number = String(payload.number ?? previous.number).trim();
  const type = String(payload.type ?? previous.type).trim();
  const status = String(payload.status ?? previous.status).trim();
  const note = payload.note === undefined ? previous.note ?? null : String(payload.note || '').trim() || null;

  if (!number || !type || !validRoomStatuses.has(status)) {
    sendJson(res, 400, { error: 'Numero, tipo y estado valido son obligatorios' });
    return;
  }

  try {
    const result = await pool.request()
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
        OUTPUT inserted.Id, inserted.Numero, inserted.Tipo, inserted.Estado, inserted.Nota
        WHERE Id = @id AND IsDeleted = 0
      `);

    const room = mapRoom(result.recordset[0]);
    await writeAudit(pool, { table: 'Habitaciones', recordId: id, action: 'UPDATE', actor, before: previous, after: room, reason: payload.reason });
    sendJson(res, 200, { room });
  } catch (error) {
    if (error?.number === 2627 || error?.number === 2601) {
      sendJson(res, 409, { error: 'Ya existe una habitacion con ese numero' });
      return;
    }
    throw error;
  }
};

// Endpoint PATCH /api/rooms/:id/status.
// Cambia el estado de una habitacion y registra auditoria STATUS_CHANGE.
const updateRoomStatusApi = async (req, res, id) => {
  const payload = await readJson(req);
  const actor = getActor(req);
  const status = String(payload.status || '').trim();

  if (!validRoomStatuses.has(status)) {
    sendJson(res, 400, { error: 'Estado de habitacion invalido' });
    return;
  }

  const pool = await getPool();
  const previous = await getRoomById(pool, id);

  if (!previous) {
    sendJson(res, 404, { error: 'Habitacion no encontrada' });
    return;
  }

  const note = payload.note === undefined ? previous.note ?? null : String(payload.note || '').trim() || null;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .input('estado', sql.NVarChar(30), status)
    .input('nota', sql.NVarChar(500), note)
    .query(`
      UPDATE dbo.Habitaciones
      SET Estado = @estado,
          Nota = @nota,
          UpdatedAt = SYSDATETIME()
      OUTPUT inserted.Id, inserted.Numero, inserted.Tipo, inserted.Estado, inserted.Nota
      WHERE Id = @id AND IsDeleted = 0
    `);

  const room = mapRoom(result.recordset[0]);
  await writeAudit(pool, { table: 'Habitaciones', recordId: id, action: 'STATUS_CHANGE', actor, before: previous, after: room, reason: payload.reason || payload.note });
  sendJson(res, 200, { room });
};

// Endpoint DELETE /api/rooms/:id.
// No borra fisicamente: marca IsDeleted=1 y registra auditoria DELETE.
const deleteRoomApi = async (req, res, id) => {
  const payload = await readJson(req).catch(() => ({}));
  const actor = getActor(req);
  const pool = await getPool();
  const previous = await getRoomById(pool, id);

  if (!previous) {
    sendJson(res, 404, { error: 'Habitacion no encontrada' });
    return;
  }

  const deletedBy = actor.username || 'Sistema';
  await pool.request()
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

  await writeAudit(pool, { table: 'Habitaciones', recordId: id, action: 'DELETE', actor, before: previous, after: { ...previous, isDeleted: true, deletedBy }, reason: payload.reason || 'Eliminacion logica de habitacion' });
  sendJson(res, 200, { ok: true });
};


// Endpoint GET /api/guests.
// Devuelve huespedes guardados para busqueda por cedula en Dashboard.
const listGuests = async (_req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT Id, Cedula, Nombres, Apellidos, Email
    FROM dbo.Huespedes
    WHERE IsDeleted = 0
    ORDER BY Nombres, Apellidos
  `);

  sendJson(res, 200, { guests: result.recordset.map(mapGuest) });
};

// Endpoint POST /api/guests.
// Crea o actualiza un huesped por cedula.
const createGuest = async (req, res) => {
  const payload = await readJson(req);
  const actor = getActor(req);
  const cedula = String(payload.cedula || '').trim();
  const nombres = String(payload.nombres || '').trim();
  const apellidos = String(payload.apellidos || '').trim();

  if (!cedula || !nombres || !apellidos) {
    sendJson(res, 400, { error: 'Cedula, nombres y apellidos son obligatorios' });
    return;
  }

  const pool = await getPool();
  const guest = await saveGuest(pool, payload, actor);
  sendJson(res, 200, { guest });
};

// Endpoint GET /api/reservations.
// Devuelve reservaciones activas para Reservaciones y Dashboard.
const listReservations = async (_req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT Id, GuestName, RoomNumber, Price, ClientType, Status, CheckinDate, CheckoutDate, CancellationReason
    FROM dbo.Reservaciones
    WHERE IsDeleted = 0
    ORDER BY CheckinDate DESC, Id DESC
  `);

  sendJson(res, 200, { reservations: result.recordset.map(mapReservation) });
};

// Endpoint POST /api/reservations.
// Crea una reservacion y evita cruces de fecha en la misma habitacion.
const createReservation = async (req, res) => {
  const payload = await readJson(req);
  const actor = getActor(req);
  const guest = String(payload.guest || '').trim();
  const room = String(payload.room || '').trim();
  const status = String(payload.status || 'Pendiente').trim();
  const clientType = payload.clientType ? String(payload.clientType).trim() : 'Persona comun';
  const price = payload.price === undefined || payload.price === null || payload.price === '' ? null : Number(payload.price);
  const checkin = String(payload.checkin || '').trim();
  const checkout = String(payload.checkout || '').trim();

  if (!guest || !room || !checkin || !checkout || !validReservationStatuses.has(status) || !validClientTypes.has(clientType)) {
    sendJson(res, 400, { error: 'Datos de reservacion invalidos' });
    return;
  }

  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    sendJson(res, 400, { error: 'El valor de la reservacion no es valido' });
    return;
  }

  const pool = await getPool();
  const conflict = await pool.request()
    .input('room', sql.NVarChar(20), room)
    .input('checkin', sql.NVarChar(10), checkin)
    .input('checkout', sql.NVarChar(10), checkout)
    .query(`
      SELECT TOP 1 Id
      FROM dbo.Reservaciones
      WHERE IsDeleted = 0
        AND Status <> 'Cancelada'
        AND LOWER(RoomNumber) = LOWER(@room)
        AND CONVERT(date, @checkin) <= CheckoutDate
        AND CONVERT(date, @checkout) >= CheckinDate
    `);

  if (conflict.recordset.length) {
    sendJson(res, 409, { error: 'La habitacion ya tiene una reserva activa en esas fechas' });
    return;
  }

  const result = await pool.request()
    .input('guest', sql.NVarChar(200), guest)
    .input('room', sql.NVarChar(20), room)
    .input('price', sql.Decimal(12, 2), price)
    .input('clientType', sql.NVarChar(30), clientType)
    .input('status', sql.NVarChar(20), status)
    .input('checkin', sql.NVarChar(10), checkin)
    .input('checkout', sql.NVarChar(10), checkout)
    .query(`
      INSERT INTO dbo.Reservaciones (GuestName, RoomNumber, Price, ClientType, Status, CheckinDate, CheckoutDate)
      OUTPUT inserted.Id, inserted.GuestName, inserted.RoomNumber, inserted.Price, inserted.ClientType, inserted.Status, inserted.CheckinDate, inserted.CheckoutDate, inserted.CancellationReason
      VALUES (@guest, @room, @price, @clientType, @status, CONVERT(date, @checkin), CONVERT(date, @checkout))
    `);

  const reservation = mapReservation(result.recordset[0]);
  await writeAudit(pool, { table: 'Reservaciones', recordId: reservation.id, action: 'CREATE', actor, before: null, after: reservation, reason: 'Creacion de reservacion' });
  sendJson(res, 201, { reservation });
};

// Endpoint PATCH /api/reservations/:id/status.
// Procesa llegada o cancelacion de una reservacion y conserva auditoria.
const updateReservationStatusApi = async (req, res, id) => {
  const payload = await readJson(req);
  const actor = getActor(req);
  const status = String(payload.status || '').trim();
  const reason = payload.reason ? String(payload.reason).trim() : null;

  if (!validReservationStatuses.has(status)) {
    sendJson(res, 400, { error: 'Estado de reservacion invalido' });
    return;
  }

  const pool = await getPool();
  const previous = await getReservationById(pool, id);

  if (!previous) {
    sendJson(res, 404, { error: 'Reservacion no encontrada' });
    return;
  }

  const deletedBy = actor.username || 'Sistema';
  const result = await pool.request()
    .input('id', sql.Int, id)
    .input('status', sql.NVarChar(20), status)
    .input('reason', sql.NVarChar(500), reason)
    .input('deletedBy', sql.NVarChar(100), deletedBy)
    .query(`
      UPDATE dbo.Reservaciones
      SET Status = @status,
          CancellationReason = CASE WHEN @status = 'Cancelada' THEN @reason ELSE CancellationReason END,
          IsDeleted = 1,
          DeletedAt = SYSDATETIME(),
          DeletedBy = @deletedBy,
          UpdatedAt = SYSDATETIME()
      OUTPUT inserted.Id, inserted.GuestName, inserted.RoomNumber, inserted.Price, inserted.ClientType, inserted.Status, inserted.CheckinDate, inserted.CheckoutDate, inserted.CancellationReason
      WHERE Id = @id AND IsDeleted = 0
    `);

  const reservation = mapReservation(result.recordset[0]);
  await writeAudit(pool, { table: 'Reservaciones', recordId: id, action: 'STATUS_CHANGE', actor, before: previous, after: reservation, reason });

  let room = null;
  let entry = null;

  if (status === 'Confirmada') {
    const previousRoom = await getRoomByNumber(pool, previous.room);
    const clientType = previous.clientType || 'Persona comun';
    const price = previous.price ?? 0;

    if (previousRoom) {
      const entryResult = await pool.request()
        .input('roomId', sql.Int, previousRoom.id)
        .input('roomNumber', sql.NVarChar(20), previousRoom.number)
        .input('guestName', sql.NVarChar(200), previous.guest)
        .input('price', sql.Decimal(12, 2), price)
        .input('clientType', sql.NVarChar(30), clientType)
        .query(`
          INSERT INTO dbo.EntradasOcupacion (RoomId, RoomNumber, GuestName, Price, ClientType, EntryDate, Status)
          OUTPUT inserted.Id, inserted.RoomId, inserted.RoomNumber, inserted.GuestId, inserted.GuestName, inserted.Price, inserted.ClientType, inserted.EntryDate, inserted.Status, inserted.CancellationReason, inserted.CanceledAt
          VALUES (@roomId, @roomNumber, @guestName, @price, @clientType, CONVERT(date, SYSDATETIME()), 'Activa')
        `);

      entry = mapOccupancyEntry(entryResult.recordset[0]);
      await writeAudit(pool, { table: 'EntradasOcupacion', recordId: entry.id, action: 'CREATE', actor, before: null, after: entry, reason: 'Llegada confirmada desde reservacion' });

      const roomResult = await pool.request()
        .input('id', sql.Int, previousRoom.id)
        .input('note', sql.NVarChar(500), `Ocupada por ${previous.guest} - ${clientType} - Valor: $${price}`)
        .query(`
          UPDATE dbo.Habitaciones
          SET Estado = 'Ocupada',
              Nota = @note,
              UpdatedAt = SYSDATETIME()
          OUTPUT inserted.Id, inserted.Numero, inserted.Tipo, inserted.Estado, inserted.Nota
          WHERE Id = @id AND IsDeleted = 0
        `);

      room = mapRoom(roomResult.recordset[0]);
      await writeAudit(pool, { table: 'Habitaciones', recordId: room.id, action: 'STATUS_CHANGE', actor, before: previousRoom, after: room, reason: 'Llegada confirmada desde reservacion' });
    }
  }

  sendJson(res, 200, { reservation, room, entry });
};

// Endpoint DELETE /api/reservations/:id.
// Elimina logicamente una reservacion y registra auditoria.
const deleteReservationApi = async (req, res, id) => {
  const payload = await readJson(req).catch(() => ({}));
  const actor = getActor(req);
  const pool = await getPool();
  const previous = await getReservationById(pool, id);

  if (!previous) {
    sendJson(res, 404, { error: 'Reservacion no encontrada' });
    return;
  }

  const deletedBy = actor.username || 'Sistema';
  await pool.request()
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

  await writeAudit(pool, { table: 'Reservaciones', recordId: id, action: 'DELETE', actor, before: previous, after: { ...previous, isDeleted: true, deletedBy }, reason: payload.reason || 'Eliminacion logica de reservacion' });
  sendJson(res, 200, { ok: true });
};

// Endpoint GET /api/occupancy.
// Devuelve entradas activas y canceladas para informes diarios/mensuales.
const listOccupancyEntries = async (_req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT Id, RoomId, RoomNumber, GuestId, GuestName, Price, ClientType, EntryDate, Status, CancellationReason, CanceledAt
    FROM dbo.EntradasOcupacion
    ORDER BY EntryDate DESC, Id DESC
  `);

  sendJson(res, 200, { occupancyEntries: result.recordset.map(mapOccupancyEntry) });
};

// Endpoint POST /api/occupancy.
// Ocupa una habitacion, guarda/actualiza huesped, crea entrada y actualiza estado de habitacion.
const createOccupancy = async (req, res) => {
  const payload = await readJson(req);
  const actor = getActor(req);
  const roomId = Number(payload.roomId);
  const price = Number(payload.price);
  const clientType = String(payload.clientType || '').trim();
  const guestPayload = payload.guest || {};

  if (!Number.isInteger(roomId) || roomId <= 0 || !Number.isFinite(price) || price <= 0 || !validClientTypes.has(clientType)) {
    sendJson(res, 400, { error: 'Datos de ocupacion invalidos' });
    return;
  }

  if (!guestPayload.cedula || !guestPayload.nombres || !guestPayload.apellidos) {
    sendJson(res, 400, { error: 'Cedula, nombres y apellidos del huesped son obligatorios' });
    return;
  }

  const pool = await getPool();
  const previousRoom = await getRoomById(pool, roomId);

  if (!previousRoom) {
    sendJson(res, 404, { error: 'Habitacion no encontrada' });
    return;
  }

  const guest = await saveGuest(pool, guestPayload, actor);
  const guestName = `${guest.nombres} ${guest.apellidos}`;
  const entryResult = await pool.request()
    .input('roomId', sql.Int, roomId)
    .input('roomNumber', sql.NVarChar(20), previousRoom.number)
    .input('guestId', sql.Int, guest.id)
    .input('guestName', sql.NVarChar(200), guestName)
    .input('price', sql.Decimal(12, 2), price)
    .input('clientType', sql.NVarChar(30), clientType)
    .query(`
      INSERT INTO dbo.EntradasOcupacion (RoomId, RoomNumber, GuestId, GuestName, Price, ClientType, EntryDate, Status)
      OUTPUT inserted.Id, inserted.RoomId, inserted.RoomNumber, inserted.GuestId, inserted.GuestName, inserted.Price, inserted.ClientType, inserted.EntryDate, inserted.Status, inserted.CancellationReason, inserted.CanceledAt
      VALUES (@roomId, @roomNumber, @guestId, @guestName, @price, @clientType, CONVERT(date, SYSDATETIME()), 'Activa')
    `);

  const entry = mapOccupancyEntry(entryResult.recordset[0]);
  await writeAudit(pool, { table: 'EntradasOcupacion', recordId: entry.id, action: 'CREATE', actor, before: null, after: entry, reason: 'Ocupacion registrada' });

  const roomResult = await pool.request()
    .input('id', sql.Int, roomId)
    .input('note', sql.NVarChar(500), `Ocupada por ${guestName} - ${clientType} - Valor: $${price}`)
    .query(`
      UPDATE dbo.Habitaciones
      SET Estado = 'Ocupada',
          Nota = @note,
          UpdatedAt = SYSDATETIME()
      OUTPUT inserted.Id, inserted.Numero, inserted.Tipo, inserted.Estado, inserted.Nota
      WHERE Id = @id AND IsDeleted = 0
    `);

  const room = mapRoom(roomResult.recordset[0]);
  await writeAudit(pool, { table: 'Habitaciones', recordId: room.id, action: 'STATUS_CHANGE', actor, before: previousRoom, after: room, reason: 'Ocupacion registrada' });
  sendJson(res, 201, { room, guest, entry });
};

// Endpoint PATCH /api/occupancy/room/:roomId/cancel.
// Cancela la entrada activa de una habitacion y la devuelve a Disponible.
const cancelOccupancyByRoom = async (req, res, roomId) => {
  const payload = await readJson(req);
  const actor = getActor(req);
  const reason = String(payload.reason || '').trim();

  if (!reason) {
    sendJson(res, 400, { error: 'El motivo de cancelacion es obligatorio' });
    return;
  }

  const pool = await getPool();
  const previousRoom = await getRoomById(pool, roomId);

  if (!previousRoom) {
    sendJson(res, 404, { error: 'Habitacion no encontrada' });
    return;
  }

  const previousEntry = await getActiveOccupancyByRoom(pool, roomId);
  let entry = null;

  if (previousEntry) {
    const entryResult = await pool.request()
      .input('id', sql.Int, previousEntry.id)
      .input('reason', sql.NVarChar(500), reason)
      .query(`
        UPDATE dbo.EntradasOcupacion
        SET Status = 'Cancelada',
            CancellationReason = @reason,
            CanceledAt = CONVERT(date, SYSDATETIME()),
            UpdatedAt = SYSDATETIME()
        OUTPUT inserted.Id, inserted.RoomId, inserted.RoomNumber, inserted.GuestId, inserted.GuestName, inserted.Price, inserted.ClientType, inserted.EntryDate, inserted.Status, inserted.CancellationReason, inserted.CanceledAt
        WHERE Id = @id AND Status = 'Activa'
      `);

    entry = mapOccupancyEntry(entryResult.recordset[0]);
    await writeAudit(pool, { table: 'EntradasOcupacion', recordId: entry.id, action: 'STATUS_CHANGE', actor, before: previousEntry, after: entry, reason });
  }

  const roomResult = await pool.request()
    .input('id', sql.Int, roomId)
    .input('note', sql.NVarChar(500), `Entrada cancelada: ${reason}`)
    .query(`
      UPDATE dbo.Habitaciones
      SET Estado = 'Disponible',
          Nota = @note,
          UpdatedAt = SYSDATETIME()
      OUTPUT inserted.Id, inserted.Numero, inserted.Tipo, inserted.Estado, inserted.Nota
      WHERE Id = @id AND IsDeleted = 0
    `);

  const room = mapRoom(roomResult.recordset[0]);
  await writeAudit(pool, { table: 'Habitaciones', recordId: room.id, action: 'STATUS_CHANGE', actor, before: previousRoom, after: room, reason });
  sendJson(res, 200, { room, entry });
};

// Endpoint GET /api/audit.
// Permite revisar la auditoria general o filtrarla por tabla/registro.
const listAudit = async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const table = url.searchParams.get('table');
  const recordId = url.searchParams.get('recordId');
  const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500);
  const pool = await getPool();
  const request = pool.request().input('limit', sql.Int, limit);
  const filters = [];

  if (table) {
    request.input('table', sql.NVarChar(100), table);
    filters.push('Tabla = @table');
  }

  if (recordId) {
    request.input('recordId', sql.Int, Number(recordId));
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
// Endpoint DELETE /api/users/:id.
// Elimina logicamente un usuario y guarda auditoria.
const deleteUser = async (req, res, id) => {
  const payload = await readJson(req).catch(() => ({}));
  const actor = getActor(req);
  const pool = await getPool();
  const previous = await getUserById(pool, id);

  if (!previous) {
    sendJson(res, 404, { error: 'Usuario no encontrado' });
    return;
  }

  const deletedBy = actor.username || 'Sistema';
  const result = await pool.request()
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

  if (!result.rowsAffected[0]) {
    sendJson(res, 404, { error: 'Usuario no encontrado' });
    return;
  }

  await writeAudit(pool, { table: 'Usuarios', recordId: id, action: 'DELETE', actor, before: previous, after: { ...previous, isDeleted: true, deletedBy }, reason: payload.reason || 'Eliminacion logica de usuario' });
  sendJson(res, 200, { ok: true });
};

// Router HTTP manual.
// Revisa metodo y URL para decidir que funcion ejecutar.
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const userIdMatch = url.pathname.match(/^\/api\/users\/(\d+)$/);
    const roomIdMatch = url.pathname.match(/^\/api\/rooms\/(\d+)$/);
    const roomStatusMatch = url.pathname.match(/^\/api\/rooms\/(\d+)\/status$/);
    const reservationIdMatch = url.pathname.match(/^\/api\/reservations\/(\d+)$/);
    const reservationStatusMatch = url.pathname.match(/^\/api\/reservations\/(\d+)\/status$/);
    const occupancyRoomCancelMatch = url.pathname.match(/^\/api\/occupancy\/room\/(\d+)\/cancel$/);

    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      await login(req, res);
      return;
    }


    if (req.method === 'GET' && url.pathname === '/api/rooms') {
      await listRooms(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/rooms') {
      await createRoom(req, res);
      return;
    }

    if (roomStatusMatch && req.method === 'PATCH') {
      await updateRoomStatusApi(req, res, Number(roomStatusMatch[1]));
      return;
    }

    if (roomIdMatch && req.method === 'PUT') {
      await updateRoom(req, res, Number(roomIdMatch[1]));
      return;
    }

    if (roomIdMatch && req.method === 'DELETE') {
      await deleteRoomApi(req, res, Number(roomIdMatch[1]));
      return;
    }


    if (req.method === 'GET' && url.pathname === '/api/guests') {
      await listGuests(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/guests') {
      await createGuest(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/reservations') {
      await listReservations(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/reservations') {
      await createReservation(req, res);
      return;
    }

    if (reservationStatusMatch && req.method === 'PATCH') {
      await updateReservationStatusApi(req, res, Number(reservationStatusMatch[1]));
      return;
    }

    if (reservationIdMatch && req.method === 'DELETE') {
      await deleteReservationApi(req, res, Number(reservationIdMatch[1]));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/occupancy') {
      await listOccupancyEntries(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/occupancy') {
      await createOccupancy(req, res);
      return;
    }

    if (occupancyRoomCancelMatch && req.method === 'PATCH') {
      await cancelOccupancyByRoom(req, res, Number(occupancyRoomCancelMatch[1]));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/audit') {
      await listAudit(req, res);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/users') {
      await listUsers(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/users') {
      await createUser(req, res);
      return;
    }

    if (userIdMatch && req.method === 'PUT') {
      await updateUser(req, res, Number(userIdMatch[1]));
      return;
    }

    if (userIdMatch && req.method === 'PATCH') {
      await toggleUserStatus(req, res, Number(userIdMatch[1]));
      return;
    }

    if (userIdMatch && req.method === 'DELETE') {
      await deleteUser(req, res, Number(userIdMatch[1]));
      return;
    }

    sendJson(res, 404, { error: 'Ruta no encontrada' });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Error interno' });
  }
});

// Inicia la API y deja el proceso escuchando peticiones.
server.listen(PORT, () => {
  console.log(`Backend Hotel conectado a ${dbConfig.server}/${dbConfig.database}`);
  console.log(`Backend Hotel escuchando en http://localhost:${PORT}`);
});
