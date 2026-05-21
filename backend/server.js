import fs from 'fs';
import http from 'http';
import path from 'path';
import sql from 'mssql/msnodesqlv8.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const PORT = Number(process.env.API_PORT || 4000);
const sqlServer = process.env.DB_INSTANCE
  ? `${process.env.DB_SERVER || 'DESKTOP-NSUD4A7'}\\${process.env.DB_INSTANCE}`
  : process.env.DB_SERVER || 'DESKTOP-NSUD4A7';

const dbConfig = {
  connectionString: [
    `Driver={${process.env.DB_DRIVER || 'ODBC Driver 17 for SQL Server'}}`,
    `Server=${sqlServer}`,
    `Database=${process.env.DB_DATABASE || 'HotelDB'}`,
    'Trusted_Connection=Yes',
    `Encrypt=${process.env.DB_ENCRYPT === 'true' ? 'Yes' : 'No'}`,
    process.env.DB_EXTRA || ''
  ].filter(Boolean).join(';'),
  server: sqlServer,
  database: process.env.DB_DATABASE || 'HotelDB',
  driver: 'msnodesqlv8',
  options: {
    trustedConnection: process.env.DB_TRUSTED_CONNECTION !== 'false',
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false'
  }
};

let poolPromise;

const getPool = async () => {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig).connect();
  }
  return poolPromise;
};

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

const sendJson = (res, status, payload) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
};

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

const publicUser = (user) => ({
  id: String(user.id),
  username: user.username,
  email: user.email,
  role: user.role
});

const login = async (req, res) => {
  const { username, password, role } = await readJson(req);
  const pool = await getPool();
  const result = await pool.request()
    .input('username', sql.NVarChar(100), String(username || '').trim())
    .input('role', sql.NVarChar(20), role)
    .query(`
      SELECT TOP 1 Id, Nombres, Apellidos, Username, Email, Password, Role, Status
      FROM dbo.Usuarios
      WHERE Username = @username AND Role = @role
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

const listUsers = async (_req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT Id, Nombres, Apellidos, Username, Email, Password, Role, Status
    FROM dbo.Usuarios
    ORDER BY Id
  `);
  sendJson(res, 200, { users: result.recordset.map(mapUser) });
};

const createUser = async (req, res) => {
  const payload = await readJson(req);
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

    sendJson(res, 201, { user: mapUser(result.recordset[0]) });
  } catch (error) {
    if (error?.number === 2627 || error?.number === 2601) {
      sendJson(res, 409, { error: 'Ya existe un usuario con ese usuario o email' });
      return;
    }
    throw error;
  }
};

const updateUser = async (req, res, id) => {
  const payload = await readJson(req);
  const username = String(payload.username || '').trim();
  const email = String(payload.email || '').trim();

  if (!payload.nombres || !payload.apellidos || !username || !email || !payload.role) {
    sendJson(res, 400, { error: 'Faltan datos obligatorios' });
    return;
  }

  try {
    const pool = await getPool();
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
        WHERE Id = @id
      `);

    if (!result.recordset.length) {
      sendJson(res, 404, { error: 'Usuario no encontrado' });
      return;
    }

    sendJson(res, 200, { user: mapUser(result.recordset[0]) });
  } catch (error) {
    if (error?.number === 2627 || error?.number === 2601) {
      sendJson(res, 409, { error: 'Ya existe un usuario con ese usuario o email' });
      return;
    }
    throw error;
  }
};

const toggleUserStatus = async (_req, res, id) => {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(`
      UPDATE dbo.Usuarios
      SET Status = CASE WHEN Status = 'Activo' THEN 'Inactivo' ELSE 'Activo' END,
          UpdatedAt = SYSDATETIME()
      OUTPUT inserted.Id, inserted.Nombres, inserted.Apellidos, inserted.Username, inserted.Email, inserted.Password, inserted.Role, inserted.Status
      WHERE Id = @id
    `);

  if (!result.recordset.length) {
    sendJson(res, 404, { error: 'Usuario no encontrado' });
    return;
  }

  sendJson(res, 200, { user: mapUser(result.recordset[0]) });
};

const deleteUser = async (_req, res, id) => {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query('DELETE FROM dbo.Usuarios WHERE Id = @id');

  if (!result.rowsAffected[0]) {
    sendJson(res, 404, { error: 'Usuario no encontrado' });
    return;
  }

  sendJson(res, 200, { ok: true });
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const userIdMatch = url.pathname.match(/^\/api\/users\/(\d+)$/);

    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      await login(req, res);
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

server.listen(PORT, () => {
  console.log(`Backend Hotel conectado a ${dbConfig.server}/${dbConfig.database}`);
  console.log(`Backend Hotel escuchando en http://localhost:${PORT}`);
});
