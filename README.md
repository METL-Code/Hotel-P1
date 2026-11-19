# Hotel Management System

Sistema de gestion hotelera con autenticacion por roles (**Administrador** y **Usuario / Trabajador**) conectado a **SQL Server** mediante una API REST en Node.js y un frontend en React, TypeScript y Vite.

## Stack Tecnologico

- **Frontend:** React 18, TypeScript, Vite, React Router 6
- **Backend:** Node.js (`http` nativo, autenticacion JWT HS256, hash de claves con `crypto.scrypt`)
- **Base de datos:** SQL Server (`mssql/msnodesqlv8` en Windows o `mssql/tedious` para hosting Linux)

## Configuracion Rapida

1. **Instalar dependencias:**
   ```bash
   npm install
   ```
2. **Crear tablas iniciales en SQL Server:**
   Ejecuta [`backend/schema.sql`](backend/schema.sql) en SQL Server Management Studio o `sqlcmd`.
3. **Configurar variables de entorno:**
   - Copia [`.env.example`](.env.example) a `.env`.
   - Copia [`backend/.env.example`](backend/.env.example) a `backend/.env` y configura `DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` y `JWT_SECRET`.

## Ejecucion en Desarrollo

Abre dos terminales en la raiz del proyecto:

```bash
# Terminal 1: Backend API (http://localhost:4000)
npm run api

# Terminal 2: Frontend Vite (http://localhost:3000)
npm run dev
```

## Build y Ejecucion en Produccion

```bash
npm run build
NODE_ENV=production npm run api
```

Cuando existe `dist/`, el servidor backend tambien sirve los archivos estaticos del frontend en el mismo puerto (`http://localhost:4000`).

## Estructura del Proyecto

```txt
backend/
├── schema.sql            # Esquema de tablas y datos iniciales en SQL Server
└── server.js             # Servidor HTTP, autenticacion JWT, transacciones y auditoria

src/
├── components/           # Rutas protegidas (ProtectedRoute)
├── context/              # AuthContext (sesion JWT) y DataContext (datos SQL Server)
├── pages/
│   ├── LoginPage.tsx     # Inicio de sesion por rol
│   ├── AdminDashboard.tsx
│   ├── admin/            # Habitaciones, Usuarios, Reservaciones, Informes, Auditoria, Configuracion
│   └── worker/           # Layout del panel operativo
├── services/api.ts       # Cliente HTTP centralizado con Bearer token y manejo 401
└── utils/format.ts       # Utilidades de fecha y formato de moneda
```

## Funcionalidades Principales

- **Autenticacion segura:** Tokens JWT firmados, hashing de claves con `scrypt`, bloqueo temporal por fuerza bruta y control de rol en el servidor.
- **Habitaciones:** Alta, estados (`Disponible`, `Ocupada`, `Mantenimiento`), notas operativas, finalizar estancia, anular entrada y borrado logico.
- **Huespedes y Ocupaciones:** Busqueda por cedula, registro transaccional de entrada y cambio atomico de estado.
- **Reservaciones:** Validacion de fechas y cruces por habitacion, calendario mensual interactivo, confirmacion de llegada y cancelacion con motivo.
- **Informes y Auditoria:** Informes diarios y mensuales filtrables por fecha/mes, indicadores en tiempo real y tabla de auditoria (`dbo.Auditoria`).
- **Configuracion Global:** Preferencias persistidas en `dbo.Configuracion`.
