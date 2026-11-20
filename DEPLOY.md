# Publicar la aplicacion en internet (gratis)

El backend ([`backend/server.js`](backend/server.js)) sirve tanto la API (`/api/*`) como el frontend compilado (`dist/`), conectado a SQL Server.

## Despliegue en un solo servicio (Render - plan Free)

1. Sube tus cambios a GitHub (`git push`).
2. En **Render**, crea un **Web Service** conectado al repositorio con:
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
3. Configura las **Environment Variables** en Render (usando los datos reales de tu SQL Server):
   - `NODE_ENV` = `production`
   - `DB_CLIENT` = `tedious`
   - `DB_SERVER` = `db53292.public.databaseasp.net,1433`
   - `DB_DATABASE` = `db53292`
   - `DB_USER` = `db53292`
   - `DB_PASSWORD` = *(tu clave de SQL Server)*
   - `DB_ENCRYPT` = `false`
   - `DB_TRUST_SERVER_CERTIFICATE` = `true`
   - `JWT_SECRET` = *(clave secreta aleatoria de al menos 32 caracteres)*

## Notas tecnicas para Linux/Render

- En Windows local, el backend usa `msnodesqlv8` (driver opcional en `package.json`) o `tedious`.
- En Linux (Render, Koyeb, Railway), `msnodesqlv8` es opcional y si no compila `npm` lo omite sin detener el deploy; el servidor usa automaticamente `mssql` (`tedious`, JavaScript puro).
- Al terminar el deploy, valida `https://tu-servicio.onrender.com/api/health` (`{"ok":true,"database":"up"}`).
