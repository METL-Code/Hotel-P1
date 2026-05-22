-- Script inicial de base de datos para SQL Server.
-- Se ejecuta manualmente en SQL Server Management Studio o una consola compatible.

-- Crea la base principal del proyecto solo si aun no existe en el servidor.
IF DB_ID('HotelDB') IS NULL
BEGIN
    CREATE DATABASE HotelDB;
END;
GO

-- A partir de aqui todas las instrucciones trabajan dentro de HotelDB.
USE HotelDB;
GO

-- Crea la tabla de usuarios solo si todavia no existe.
-- Esta tabla es la que usa backend/server.js para el login y el CRUD de usuarios.
IF OBJECT_ID('dbo.Usuarios', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Usuarios (
        Id INT IDENTITY(1,1) PRIMARY KEY, -- Identificador automatico de cada usuario.
        Nombres NVARCHAR(100) NOT NULL, -- Nombres reales visibles en la lista de usuarios.
        Apellidos NVARCHAR(100) NOT NULL, -- Apellidos reales visibles en la lista de usuarios.
        Username NVARCHAR(100) NOT NULL UNIQUE, -- Usuario usado para iniciar sesion.
        Email NVARCHAR(150) NOT NULL UNIQUE, -- Correo mostrado en paneles y tabla de usuarios.
        Password NVARCHAR(255) NOT NULL, -- Clave actual en texto plano; solo apto para pruebas locales.
        Role NVARCHAR(20) NOT NULL CHECK (Role IN ('admin', 'trabajador')), -- Define acceso a /admin o /trabajador.
        Status NVARCHAR(20) NOT NULL DEFAULT 'Activo' CHECK (Status IN ('Activo', 'Inactivo')), -- Permite bloquear usuarios.
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(), -- Fecha de creacion del registro.
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(), -- Fecha de ultima actualizacion.
        IsDeleted BIT NOT NULL DEFAULT 0, -- Borrado logico para no perder trazabilidad.
        DeletedAt DATETIME2 NULL, -- Fecha de eliminacion logica.
        DeletedBy NVARCHAR(100) NULL -- Usuario que elimino el registro.
    );
END;
GO

-- Agrega columnas de borrado logico a instalaciones anteriores de Usuarios.
IF COL_LENGTH('dbo.Usuarios', 'IsDeleted') IS NULL
BEGIN
    ALTER TABLE dbo.Usuarios ADD IsDeleted BIT NOT NULL CONSTRAINT DF_Usuarios_IsDeleted DEFAULT 0;
END;
GO
IF COL_LENGTH('dbo.Usuarios', 'DeletedAt') IS NULL
BEGIN
    ALTER TABLE dbo.Usuarios ADD DeletedAt DATETIME2 NULL;
END;
GO
IF COL_LENGTH('dbo.Usuarios', 'DeletedBy') IS NULL
BEGIN
    ALTER TABLE dbo.Usuarios ADD DeletedBy NVARCHAR(100) NULL;
END;
GO

-- Crea la tabla de habitaciones.
-- Esta tabla reemplaza el localStorage para las habitaciones visibles en Dashboard y Habitaciones.
IF OBJECT_ID('dbo.Habitaciones', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Habitaciones (
        Id INT IDENTITY(1,1) PRIMARY KEY, -- Identificador automatico de la habitacion.
        Numero NVARCHAR(20) NOT NULL UNIQUE, -- Numero visible de habitacion, por ejemplo 101.
        Tipo NVARCHAR(50) NOT NULL, -- Tipo visible: Individual, Doble, Suite, etc.
        Estado NVARCHAR(30) NOT NULL CHECK (Estado IN ('Disponible', 'Ocupada', 'Mantenimiento')), -- Estado visible en tarjetas y tablas.
        Nota NVARCHAR(500) NULL, -- Nota operativa visible en modales del dashboard.
        IsDeleted BIT NOT NULL DEFAULT 0, -- Borrado logico: 0 visible, 1 eliminado.
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(), -- Fecha de creacion.
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(), -- Fecha de ultima actualizacion.
        DeletedAt DATETIME2 NULL, -- Fecha de eliminacion logica.
        DeletedBy NVARCHAR(100) NULL -- Usuario que elimino la habitacion.
    );
END;
GO

-- Crea la tabla de huespedes.
-- Se usa al ocupar habitaciones y para buscar por cedula desde el Dashboard.
IF OBJECT_ID('dbo.Huespedes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Huespedes (
        Id INT IDENTITY(1,1) PRIMARY KEY, -- Identificador automatico del huesped.
        Cedula NVARCHAR(50) NOT NULL UNIQUE, -- Documento usado para buscar y reutilizar datos.
        Nombres NVARCHAR(100) NOT NULL, -- Nombres del huesped.
        Apellidos NVARCHAR(100) NOT NULL, -- Apellidos del huesped.
        Email NVARCHAR(150) NULL, -- Correo opcional del huesped.
        IsDeleted BIT NOT NULL DEFAULT 0, -- Borrado logico si mas adelante se elimina un huesped.
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(), -- Fecha de creacion.
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(), -- Fecha de ultima actualizacion.
        DeletedAt DATETIME2 NULL, -- Fecha de eliminacion logica.
        DeletedBy NVARCHAR(100) NULL -- Usuario que elimino el huesped.
    );
END;
GO

-- Crea la tabla de reservaciones.
-- Alimenta la pantalla Reservaciones y las tarjetas de reservas del Dashboard.
IF OBJECT_ID('dbo.Reservaciones', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Reservaciones (
        Id INT IDENTITY(1,1) PRIMARY KEY, -- Identificador automatico de la reserva.
        GuestName NVARCHAR(200) NOT NULL, -- Nombre visible del huesped en la reserva.
        RoomNumber NVARCHAR(20) NOT NULL, -- Numero de habitacion reservado.
        Price DECIMAL(12,2) NULL, -- Valor acordado de la reserva.
        ClientType NVARCHAR(30) NULL CHECK (ClientType IS NULL OR ClientType IN ('Persona comun', 'Persona recurrente')), -- Tipo de cliente.
        Status NVARCHAR(20) NOT NULL CHECK (Status IN ('Confirmada', 'Pendiente', 'Cancelada')), -- Estado visible de la reserva.
        CheckinDate DATE NOT NULL, -- Fecha de entrada.
        CheckoutDate DATE NOT NULL, -- Fecha de salida.
        CancellationReason NVARCHAR(500) NULL, -- Motivo si se cancela.
        IsDeleted BIT NOT NULL DEFAULT 0, -- Borrado/procesado logico para conservar auditoria.
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(), -- Fecha de creacion.
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(), -- Fecha de ultima actualizacion.
        DeletedAt DATETIME2 NULL, -- Fecha de eliminacion/procesamiento logico.
        DeletedBy NVARCHAR(100) NULL -- Usuario que elimino/proceso la reserva.
    );
END;
GO

-- Crea la tabla de entradas/ocupaciones.
-- Alimenta informes diarios y mensuales para admin y trabajador.
IF OBJECT_ID('dbo.EntradasOcupacion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EntradasOcupacion (
        Id INT IDENTITY(1,1) PRIMARY KEY, -- Identificador automatico de la entrada.
        RoomId INT NULL, -- Id de habitacion si existe en dbo.Habitaciones.
        RoomNumber NVARCHAR(20) NOT NULL, -- Numero de habitacion visible en informes.
        GuestId INT NULL, -- Id de huesped si se registro por cedula.
        GuestName NVARCHAR(200) NOT NULL, -- Nombre visible del huesped.
        Price DECIMAL(12,2) NOT NULL, -- Valor usado para informes.
        ClientType NVARCHAR(30) NOT NULL CHECK (ClientType IN ('Persona comun', 'Persona recurrente')), -- Tipo de cliente.
        EntryDate DATE NOT NULL DEFAULT CONVERT(date, SYSDATETIME()), -- Dia en que se ocupa la habitacion.
        Status NVARCHAR(20) NOT NULL CHECK (Status IN ('Activa', 'Cancelada')), -- Estado de la entrada.
        CancellationReason NVARCHAR(500) NULL, -- Motivo si se cancela la entrada.
        CanceledAt DATE NULL, -- Dia en que se cancelo.
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(), -- Fecha exacta de creacion.
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME() -- Fecha exacta de ultima actualizacion.
    );
END;
GO

-- Crea la tabla de auditoria general.
-- Aqui se registran creaciones, cambios de estado, actualizaciones y eliminaciones logicas.
IF OBJECT_ID('dbo.Auditoria', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Auditoria (
        Id INT IDENTITY(1,1) PRIMARY KEY, -- Identificador automatico de auditoria.
        Tabla NVARCHAR(100) NOT NULL, -- Tabla afectada, por ejemplo Habitaciones.
        RegistroId INT NULL, -- Id del registro afectado.
        Accion NVARCHAR(50) NOT NULL, -- CREATE, UPDATE, STATUS_CHANGE, DELETE, etc.
        UsuarioId NVARCHAR(50) NULL, -- Id del usuario enviado por el frontend.
        UsuarioNombre NVARCHAR(150) NULL, -- Nombre del usuario enviado por el frontend.
        DatosAnteriores NVARCHAR(MAX) NULL, -- JSON con el estado anterior.
        DatosNuevos NVARCHAR(MAX) NULL, -- JSON con el estado nuevo.
        Motivo NVARCHAR(500) NULL, -- Motivo opcional de la accion.
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME() -- Fecha exacta de la auditoria.
    );
END;
GO

-- Usuario administrador inicial para entrar al panel de administracion.
IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Username = 'admin' AND IsDeleted = 0)
BEGIN
    INSERT INTO dbo.Usuarios (Nombres, Apellidos, Username, Email, Password, Role, Status)
    VALUES ('Administrador', 'Principal', 'admin', 'admin@hotel.com', 'admin123', 'admin', 'Activo');
END;
GO

-- Usuario operativo inicial para entrar al panel de trabajador.
IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Username = 'usuario' AND IsDeleted = 0)
BEGIN
    INSERT INTO dbo.Usuarios (Nombres, Apellidos, Username, Email, Password, Role, Status)
    VALUES ('Usuario', 'Operativo', 'usuario', 'usuario@hotel.com', 'trabajador123', 'trabajador', 'Activo');
END;
GO

-- Habitaciones iniciales para que el panel tenga datos al conectarse por primera vez a SQL.
IF NOT EXISTS (SELECT 1 FROM dbo.Habitaciones WHERE IsDeleted = 0)
BEGIN
    INSERT INTO dbo.Habitaciones (Numero, Tipo, Estado, Nota)
    VALUES
        ('101', 'Doble', 'Disponible', NULL),
        ('102', 'Suite', 'Ocupada', NULL),
        ('103', 'Individual', 'Disponible', NULL),
        ('104', 'Doble', 'Mantenimiento', 'En mantenimiento');
END;
GO

-- Reservas iniciales para que la pantalla Reservaciones tenga datos al conectar SQL por primera vez.
IF NOT EXISTS (SELECT 1 FROM dbo.Reservaciones WHERE IsDeleted = 0)
BEGIN
    INSERT INTO dbo.Reservaciones (GuestName, RoomNumber, Price, ClientType, Status, CheckinDate, CheckoutDate)
    VALUES
        ('Luis Fernandez', '101', 0, 'Persona comun', 'Confirmada', '2026-06-01', '2026-06-05'),
        ('Ana Gomez', '102', 0, 'Persona comun', 'Pendiente', '2026-06-04', '2026-06-06'),
        ('Mario Lopez', '103', 0, 'Persona comun', 'Cancelada', '2026-06-10', '2026-06-12');
END;
GO

-- Muestra datos base para comprobar que el script funciono.
SELECT * FROM dbo.Usuarios WHERE IsDeleted = 0;
SELECT * FROM dbo.Habitaciones WHERE IsDeleted = 0;
SELECT * FROM dbo.Huespedes WHERE IsDeleted = 0;
SELECT * FROM dbo.Reservaciones WHERE IsDeleted = 0;
SELECT * FROM dbo.EntradasOcupacion ORDER BY EntryDate DESC, Id DESC;
SELECT TOP 20 * FROM dbo.Auditoria ORDER BY CreatedAt DESC;
GO