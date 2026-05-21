# 🗄️ Integración con SQL Server

Este documento explica cómo conectar tu aplicación React con SQL Server para una autenticación real.

## 📋 Requisitos

- SQL Server instalado
- Node.js con Express.js
- SQL Server Management Studio (SSMS) - Opcional pero recomendado

## 🏗️ Arquitectura

```
Frontend (React)
      ↓
API Backend (Node.js/Express)
      ↓
SQL Server (Base de datos)
```

## 📝 Paso 1: Crear la Base de Datos

```sql
-- Crear base de datos
CREATE DATABASE HotelDB;
USE HotelDB;

-- Crear tabla de usuarios
CREATE TABLE Usuarios (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Username NVARCHAR(100) NOT NULL UNIQUE,
    Email NVARCHAR(100) NOT NULL UNIQUE,
    Password NVARCHAR(255) NOT NULL,
    Role NVARCHAR(50) NOT NULL, -- 'admin' o 'trabajador'
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE()
);

-- Insertar usuarios de prueba (usar bcrypt en producción)
INSERT INTO Usuarios (Username, Email, Password, Role) VALUES
('admin_user', 'admin@hotel.com', 'HASH_DEL_PASSWORD_admin123', 'admin'),
('worker_user', 'worker@hotel.com', 'HASH_DEL_PASSWORD_trabajador123', 'trabajador');
```

## 🔧 Paso 2: Crear Backend (Express + SQL Server)

### 2.1 Instalar dependencias
```bash
mkdir hotel-backend
cd hotel-backend
npm init -y
npm install express mssql bcryptjs jsonwebtoken cors dotenv
npm install -D nodemon
```

### 2.2 Crear archivo `.env`
```
DB_USER=sa
DB_PASSWORD=TuContraseña123
DB_SERVER=localhost
DB_NAME=HotelDB
DB_PORT=1433
JWT_SECRET=tu_jwt_secret_muy_seguro
PORT=5000
```

### 2.3 Crear `config/database.js`
```javascript
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT),
  authentication: {
    type: 'default'
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableKeepAlive: true
  }
};

let pool;

const connectDB = async () => {
  try {
    pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('✅ Conectado a SQL Server');
    return pool;
  } catch (error) {
    console.error('❌ Error conectando a BD:', error);
  }
};

const getPool = () => pool;

module.exports = { connectDB, getPool };
```

### 2.4 Crear `routes/auth.js`
```javascript
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/database');

const router = express.Router();

// Ruta de Login
router.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    const pool = getPool();
    const result = await pool.request()
      .input('username', username)
      .query('SELECT * FROM Usuarios WHERE Username = @username AND Role = @role');

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const user = result.recordset[0];

    // Verificar contraseña (asegúrate que en BD está hasheada)
    const passwordMatch = await bcrypt.compare(password, user.Password);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    // Generar JWT token
    const token = jwt.sign(
      { 
        id: user.Id, 
        username: user.Username, 
        role: user.Role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.Id,
        username: user.Username,
        email: user.Email,
        role: user.Role
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

module.exports = router;
```

### 2.5 Crear `server.js`
```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/database');
const authRoutes = require('./routes/auth');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Conectar a BD
connectDB();

// Rutas
app.use('/api/auth', authRoutes);

// Puerto
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
});
```

### 2.6 Actualizar `package.json` scripts
```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js"
}
```

## 🔗 Paso 3: Conectar Frontend con Backend

### 3.1 Actualizar `src/context/AuthContext.tsx`

```typescript
import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'trabajador';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string, role: 'admin' | 'trabajador') => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = async (username: string, password: string, role: 'admin' | 'trabajador') => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al iniciar sesión');
      }

      const data = await response.json();
      
      // Guardar token en localStorage
      localStorage.setItem('token', data.token);
      
      // Guardar usuario
      setUser(data.user);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};
```

## 🚀 Cómo Ejecutar Todo Junto

### Terminal 1: Backend
```bash
cd hotel-backend
npm run dev
```

### Terminal 2: Frontend
```bash
npm run dev
```

## ✅ Checklist de Seguridad

- [ ] Cambiar contraseñas por hashes con bcrypt
- [ ] Usar HTTPS en producción
- [ ] Cambiar JWT_SECRET a algo seguro
- [ ] Validar entrada en backend
- [ ] Usar SQL parameterized queries (ya hecho)
- [ ] Agregar rate limiting
- [ ] Implement refresh tokens

## 🔒 Mejoras de Seguridad Recomendadas

1. **Hash de Contraseñas**: Usa bcrypt
2. **Validación en Backend**: Siempre valida en servidor
3. **CORS**: Configura correctamente
4. **Rate Limiting**: Previene fuerza bruta
5. **HTTPS**: Obligatorio en producción

## 📊 Queries Útiles de SQL Server

```sql
-- Ver todos los usuarios
SELECT * FROM Usuarios;

-- Ver admins
SELECT * FROM Usuarios WHERE Role = 'admin';

-- Ver trabajadores
SELECT * FROM Usuarios WHERE Role = 'trabajador';

-- Contar usuarios por rol
SELECT Role, COUNT(*) as Total FROM Usuarios GROUP BY Role;
```

## 🐛 Troubleshooting

**Error: "Cannot connect to SQL Server"**
- Verifica que SQL Server está corriendo
- Revisa credenciales en `.env`
- Asegúrate que la BD existe

**Error: "401 Unauthorized"**
- Verifica usuario y contraseña
- Comprueba que el usuario existe en la BD
- Verifica que el rol coincide

**Error: "CORS error"**
- Revisa CORS en Express
- Verifica URL del backend en frontend

---

¡Ahora tienes un sistema de login completo con SQL Server! 🎉
