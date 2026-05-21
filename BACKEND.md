# Backend con SQL Server

El backend usa SQL Server con autenticacion Windows.

## 1. Crear base de datos

Abre SQL Server Management Studio y ejecuta:

```txt
backend/schema.sql
```

Ese script crea:

- Base de datos `HotelDB`
- Tabla `dbo.Usuarios`
- Usuario admin inicial
- Usuario operativo inicial

## 2. Configurar conexion

La conexion esta en:

```txt
backend/.env
```

Configuracion actual:

```env
API_PORT=4000
DB_SERVER=DESKTOP-NSUD4A7
DB_DATABASE=HotelDB
DB_DRIVER=ODBC Driver 17 for SQL Server
DB_TRUSTED_CONNECTION=true
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
```

## Si no conecta

Si el backend muestra un error como `Server is not found or not accessible`, habilita TCP/IP:

1. Abre `SQL Server Configuration Manager` como administrador.
2. Ve a `SQL Server Network Configuration`.
3. Entra a `Protocols for MSSQLSERVER`.
4. Habilita `TCP/IP`.
5. Opcional: habilita `Named Pipes`.
6. Reinicia el servicio `SQL Server (MSSQLSERVER)`.

En tu equipo tambien existe una instancia llamada `MONMA`. Si tu base esta ahi:

1. Entra a `Protocols for MONMA`.
2. Habilita `TCP/IP`.
3. Reinicia `SQL Server (MONMA)`.
4. Cambia `backend/.env`:

```env
DB_SERVER=DESKTOP-NSUD4A7
DB_INSTANCE=MONMA
```

Si en SSMS el servidor aparece como instancia nombrada, cambia `DB_SERVER` por algo como:

```env
DB_SERVER=DESKTOP-NSUD4A7
DB_INSTANCE=SQLEXPRESS
```

En tu equipo tambien aparece una instancia llamada `MONMA`. Si esa es la que usas en SSMS, configura:

```env
DB_SERVER=DESKTOP-NSUD4A7
DB_INSTANCE=MONMA
```

## 3. Ejecutar backend

En una terminal:

```bash
npm.cmd run api
```

El backend queda en:

```txt
http://localhost:4000
```

## 4. Ejecutar frontend

En otra terminal:

```bash
npm.cmd run dev
```

El frontend queda en:

```txt
http://localhost:3000
```

## Endpoints

```txt
POST   /api/auth/login
GET    /api/users
POST   /api/users
PUT    /api/users/:id
PATCH  /api/users/:id
DELETE /api/users/:id
```

## Credenciales iniciales

Administrador:

```txt
usuario: admin
clave: admin123
```

Usuario:

```txt
usuario: usuario
clave: trabajador123
```
