# 🚀 GUÍA DE INICIO RÁPIDO

## ¿Qué es este proyecto?

Un sistema completo de login para un hotel con **dos roles**:
- **Administrador** 👨‍💼 - Acceso completo
- **Trabajador** 👨‍💻 - Acceso limitado a tareas

## ⚙️ Instalación (Paso a Paso)

### 1. Abre la terminal en VS Code
- Presiona `Ctrl + `\` ` (o ve a Terminal > New Terminal)

### 2. Navega a la carpeta del proyecto
```bash
cd c:\Proyecto_Personal\Hotel
```

### 3. Instala las dependencias necesarias
```bash
npm install
```
> Esto descargará todos los paquetes necesarios (React, Router, etc.)

### 4. Inicia el servidor de desarrollo
```bash
npm run dev
```

> La aplicación se abrirá automáticamente en tu navegador en http://localhost:3000

## 📝 Cómo Probar el Login

### Opción 1: Login como Administrador
1. En la página de login, haz clic en **"Administrador" 👨‍💼**
2. Introduce:
   - **Usuario**: usuario
   - **Contraseña**: admin123
3. ¡Verás el dashboard del administrador!

### Opción 2: Login como Trabajador
1. En la página de login, haz clic en **"Trabajador" 👨‍💻**
2. Introduce:
   - **Usuario**: usuario
   - **Contraseña**: trabajador123
3. ¡Verás el dashboard del trabajador!

## 📂 Estructura de Carpetas

```
Hotel/
├── src/
│   ├── components/          # Componentes reutilizables
│   │   └── ProtectedRoute.tsx
│   ├── context/             # Estado global (autenticación)
│   │   └── AuthContext.tsx
│   ├── pages/               # Páginas principales
│   │   ├── LoginPage.tsx    # Página de login
│   │   ├── AdminDashboard.tsx
│   │   └── WorkerDashboard.tsx
│   ├── App.tsx              # Componente raíz
│   └── main.tsx             # Punto de entrada
├── index.html               # Archivo HTML principal
├── package.json             # Dependencias del proyecto
├── vite.config.ts           # Configuración de Vite
└── tsconfig.json            # Configuración de TypeScript
```

## 🔐 Seguridad

- ✅ Las rutas están **protegidas** - no puedes acceder sin login
- ✅ Cada rol tiene su propio dashboard
- ✅ Al cerrar sesión, vuelves a la página de login

## 🎨 Características Principales

### Página de Login
- Selección visual de rol
- Validación de credenciales
- Mensajes de error personalizados
- Diseño moderno y responsive

### Dashboard de Administrador
- Estadísticas generales
- Acceso a todas las funciones
- Gestión de usuarios y habitaciones

### Dashboard de Trabajador
- Tareas asignadas
- Habitaciones a su cargo
- Seguimiento de progreso
- Opciones para reportar problemas

## 🛠️ Comandos Útiles

```bash
# Iniciar desarrollo (con auto-refresh)
npm run dev

# Crear versión optimizada para producción
npm run build

# Ver la versión de producción localmente
npm run preview

# (Opcional) Si quieres usar linter de TypeScript
npm run lint
```

## 🔄 Próximos Pasos

Si quieres expandir este proyecto:

### 1. **Conectar con Base de Datos SQL Server**
   - Crear un backend (Node.js/Express, .NET, etc.)
   - Implementar autenticación real
   - Guardar usuarios en SQL Server

### 2. **Agregar Más Funcionalidades**
   - Crear, editar, eliminar usuarios
   - Gestión completa de habitaciones
   - Sistema de reservaciones
   - Reportes detallados

### 3. **Mejorar Seguridad**
   - Implementar JWT tokens
   - Hash de contraseñas
   - HTTPS en producción
   - Validaciones en backend

### 4. **Mejorar UI/UX**
   - Agregar más iconos
   - Temas personalizables
   - Modo oscuro
   - Notificaciones

## ❓ Preguntas Frecuentes

**P: ¿Dónde se guardan los datos?**
R: Actualmente todo es en memoria (se pierden al cerrar). Para persistencia, necesitas conectar a SQL Server.

**P: ¿Puedo cambiar los colores?**
R: Sí, edita los archivos `.css` en cada componente. Los colores están definidos con códigos hexadecimales.

**P: ¿Cómo agrego más usuarios?**
R: En el archivo `src/context/AuthContext.tsx` en la función `login`, ajusta la validación.

**P: ¿Puedo desplegar esto en internet?**
R: Sí, primero necesitas un backend y luego puedes usar servicios como Vercel, Netlify, etc.

## 📧 Notas Finales

- Este es un **proyecto frontend completo** pero sin backend
- Para producción, **necesitarás conectar a SQL Server**
- El código está comentado y es fácil de entender
- Puedes personalizar todo según necesites

---

**¡Listo para empezar! 🎉**

Si tienes dudas, revisa el README.md para más detalles técnicos.
