-- Script inicial de base de datos para SQL Server.
-- Se ejecuta manualmente en SQL Server Management Studio o una consola compatible.

-- Nombre de base por defecto para desarrollo local.
-- En hosting se puede sobrescribir con: sqlcmd -v DatabaseName="nombre_real"
:setvar DatabaseName "HotelDB"

-- Crea la base principal del proyecto solo si aun no existe y el usuario tiene permiso.
IF DB_ID(N'$(DatabaseName)') IS NULL
BEGIN
    DECLARE @createDatabaseSql NVARCHAR(MAX) = N'CREATE DATABASE ' + QUOTENAME(N'$(DatabaseName)');
    EXEC (@createDatabaseSql);
END;
GO

-- A partir de aqui todas las instrucciones trabajan dentro de la base configurada.
USE [$(DatabaseName)];
GO

-- Crea la tabla de usuarios solo si todavia no existe.
-- Las claves nuevas se almacenan con hash scrypt; las antiguas en texto plano se migran al primer login.
IF OBJECT_ID('dbo.Usuarios', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Usuarios (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Nombres NVARCHAR(100) NOT NULL,
        Apellidos NVARCHAR(100) NOT NULL,
        Username NVARCHAR(100) NOT NULL UNIQUE,
        Email NVARCHAR(150) NOT NULL UNIQUE,
        Password NVARCHAR(255) NOT NULL,
        Role NVARCHAR(20) NOT NULL CHECK (Role IN ('admin', 'trabajador')),
        Status NVARCHAR(20) NOT NULL DEFAULT 'Activo' CHECK (Status IN ('Activo', 'Inactivo')),
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        IsDeleted BIT NOT NULL DEFAULT 0,
        DeletedAt DATETIME2 NULL,
        DeletedBy NVARCHAR(100) NULL
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
IF OBJECT_ID('dbo.Habitaciones', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Habitaciones (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Numero NVARCHAR(20) NOT NULL UNIQUE,
        Tipo NVARCHAR(50) NOT NULL,
        Estado NVARCHAR(30) NOT NULL CHECK (Estado IN ('Disponible', 'Ocupada', 'Mantenimiento')),
        Nota NVARCHAR(500) NULL,
        IsDeleted BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        DeletedAt DATETIME2 NULL,
        DeletedBy NVARCHAR(100) NULL
    );
END;
GO

-- Crea la tabla de huespedes.
IF OBJECT_ID('dbo.Huespedes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Huespedes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Cedula NVARCHAR(50) NOT NULL UNIQUE,
        Nombres NVARCHAR(100) NOT NULL,
        Apellidos NVARCHAR(100) NOT NULL,
        Email NVARCHAR(150) NULL,
        IsDeleted BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        DeletedAt DATETIME2 NULL,
        DeletedBy NVARCHAR(100) NULL
    );
END;
GO

-- Crea la tabla de reservaciones.
IF OBJECT_ID('dbo.Reservaciones', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Reservaciones (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        GuestName NVARCHAR(200) NOT NULL,
        RoomNumber NVARCHAR(20) NOT NULL,
        Price DECIMAL(12,2) NULL,
        ClientType NVARCHAR(30) NULL CHECK (ClientType IS NULL OR ClientType IN ('Persona comun', 'Persona recurrente')),
        Status NVARCHAR(20) NOT NULL CHECK (Status IN ('Confirmada', 'Pendiente', 'Cancelada')),
        CheckinDate DATE NOT NULL,
        CheckoutDate DATE NOT NULL,
        CancellationReason NVARCHAR(500) NULL,
        IsDeleted BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        DeletedAt DATETIME2 NULL,
        DeletedBy NVARCHAR(100) NULL,
        ProcessedAt DATETIME2 NULL
    );
END;
GO

-- Agrega columna ProcessedAt si la tabla venia de una version anterior.
IF COL_LENGTH('dbo.Reservaciones', 'ProcessedAt') IS NULL
BEGIN
    ALTER TABLE dbo.Reservaciones ADD ProcessedAt DATETIME2 NULL;
END;
GO

-- Crea la tabla de entradas/ocupaciones.
IF OBJECT_ID('dbo.EntradasOcupacion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EntradasOcupacion (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RoomId INT NULL,
        RoomNumber NVARCHAR(20) NOT NULL,
        GuestId INT NULL,
        GuestName NVARCHAR(200) NOT NULL,
        Price DECIMAL(12,2) NOT NULL,
        ClientType NVARCHAR(30) NOT NULL CHECK (ClientType IN ('Persona comun', 'Persona recurrente')),
        EntryDate DATE NOT NULL DEFAULT CONVERT(date, SYSDATETIME()),
        Status NVARCHAR(20) NOT NULL CHECK (Status IN ('Activa', 'Cancelada')),
        CancellationReason NVARCHAR(500) NULL,
        CanceledAt DATE NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END;
GO

-- Crea la tabla de auditoria general.
IF OBJECT_ID('dbo.Auditoria', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Auditoria (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Tabla NVARCHAR(100) NOT NULL,
        RegistroId INT NULL,
        Accion NVARCHAR(50) NOT NULL,
        UsuarioId NVARCHAR(50) NULL,
        UsuarioNombre NVARCHAR(150) NULL,
        DatosAnteriores NVARCHAR(MAX) NULL,
        DatosNuevos NVARCHAR(MAX) NULL,
        Motivo NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END;
GO

-- Crea la tabla de configuracion global del sistema.
IF OBJECT_ID('dbo.Configuracion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Configuracion (
        Clave NVARCHAR(100) PRIMARY KEY,
        Valor NVARCHAR(500) NOT NULL,
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedBy NVARCHAR(100) NULL
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion WHERE Clave = 'notifications')
    INSERT INTO dbo.Configuracion (Clave, Valor) VALUES ('notifications', 'true');
IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion WHERE Clave = 'maintenanceMode')
    INSERT INTO dbo.Configuracion (Clave, Valor) VALUES ('maintenanceMode', 'false');
IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion WHERE Clave = 'alertLowStock')
    INSERT INTO dbo.Configuracion (Clave, Valor) VALUES ('alertLowStock', 'true');
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
SELECT * FROM dbo.Configuracion;
SELECT TOP 20 * FROM dbo.Auditoria ORDER BY CreatedAt DESC;
GO
