# 🏨 Hotel Management System - Login

Sistema de gestión hotelera con autenticación de roles (Administrador y Trabajador) construido con React, TypeScript y Vite.

## 📋 Características

- ✅ **Autenticación de dos roles**:
  - **Administrador**: Acceso completo al sistema
  - **Trabajador**: Acceso limitado a tareas y asignaciones
  
- 🎨 **Interfaz moderna y responsiva** con diseño profesional
- 🔐 **Rutas protegidas** que requieren autenticación
- 📱 **Diseño mobile-friendly** que se adapta a cualquier pantalla
- 🎯 **Dashboards personalizados** según el rol del usuario

## 🚀 Inicio Rápido

### Requisitos
- Node.js (versión 16 o superior)
- npm o yarn

### Instalación

1. **Clonar el repositorio**
```bash
cd c:\Proyecto_Personal\Hotel
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Ejecutar en modo desarrollo**
```bash
npm run dev
```

La aplicación se abrirá automáticamente en `http://localhost:3000`

### Build para producción
```bash
npm run build
```

### Preview de la build
```bash
npm run preview
```

## 🔐 Credenciales de Demo

### Administrador
- **Usuario**: usuario
- **Contraseña**: admin123

### Trabajador
- **Usuario**: usuario
- **Contraseña**: trabajador123

## 📁 Estructura del Proyecto

```
src/
├── components/
│   └── ProtectedRoute.tsx      # Componente de rutas protegidas
├── context/
│   └── AuthContext.tsx         # Contexto de autenticación
├── pages/
│   ├── LoginPage.tsx           # Página de login
│   ├── LoginPage.css
│   ├── AdminDashboard.tsx      # Dashboard de administrador
│   ├── AdminDashboard.css
│   ├── WorkerDashboard.tsx     # Dashboard de trabajador
│   └── WorkerDashboard.css
├── App.tsx                      # Componente principal
├── App.css
├── main.tsx                     # Punto de entrada
└── index.css
```

## 🎯 Funcionalidades

### 🔑 Página de Login
- Seleccionar rol (Administrador o Trabajador)
- Autenticación con usuario y contraseña
- Validación de credenciales
- Mensajes de error personalizados

### 👨‍💼 Dashboard Administrador
- Vista general de estadísticas
- Gestión de usuarios
- Gestión de habitaciones
- Control de reservaciones
- Reportes del sistema
- Acceso a configuración

### 👨‍💻 Dashboard Trabajador
- Tareas asignadas
- Habitaciones asignadas
- Seguimiento de tareas completadas
- Registro de horas trabajadas
- Opción de reportar problemas
- Contacto con supervisor

## 🔄 Flujo de Autenticación

1. Usuario ingresa a la aplicación
2. Selecciona su rol (Admin o Trabajador)
3. Introduce sus credenciales
4. El sistema valida las credenciales
5. Si es correcto, se redirige al dashboard correspondiente
6. Las rutas están protegidas y requieren autenticación

## 🛠️ Tecnologías Utilizadas

- **React 18.2** - Librería UI
- **TypeScript** - Tipado estático
- **Vite 5.0** - Build tool
- **React Router 6.20** - Enrutamiento
- **CSS3** - Estilos modernos

## 🔄 Próximas Características

- [ ] Integración con SQL Server
- [ ] Sistema de permisos granulares
- [ ] Recuperación de contraseña
- [ ] Autenticación con token JWT
- [ ] Historial de actividades
- [ ] Notificaciones en tiempo real
- [ ] Temas personalizables

## 📝 Notas Importantes

### Autenticación Demo
Este proyecto usa una autenticación simulada en el contexto. Para producción, necesitarás:

1. **Backend API** con autenticación real
2. **Base de datos SQL Server** con tabla de usuarios
3. **Tokens JWT** para mantener la sesión
4. **HTTPS** en producción
5. **Hash de contraseñas** con bcrypt o similar

### Ejemplo de integración con backend:
```typescript
// En AuthContext.tsx - login function
const response = await fetch('https://tu-api.com/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password, role })
});

const data = await response.json();
if (data.token) {
  localStorage.setItem('token', data.token);
  setUser(data.user);
}
```

## 📞 Soporte

Para reportar problemas o sugerencias, por favor abre un issue en el repositorio.

## 📄 Licencia

Este proyecto está disponible bajo la licencia MIT.

---

**Desarrollado con ❤️ para Hotel Management System**
