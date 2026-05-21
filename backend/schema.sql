CREATE DATABASE HotelDB;
GO

USE HotelDB;
GO

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
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Username = 'admin')
BEGIN
    INSERT INTO dbo.Usuarios (Nombres, Apellidos, Username, Email, Password, Role, Status)
    VALUES ('Administrador', 'Principal', 'admin', 'admin@hotel.com', 'admin123', 'admin', 'Activo');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Username = 'usuario')
BEGIN
    INSERT INTO dbo.Usuarios (Nombres, Apellidos, Username, Email, Password, Role, Status)
    VALUES ('Usuario', 'Operativo', 'usuario', 'usuario@hotel.com', 'trabajador123', 'trabajador', 'Activo');
END;
GO

SELECT * FROM dbo.Usuarios;
GO
