# Publicar la aplicacion

Esta aplicacion esta lista para publicarse como sitio estatico de Vite.

## Antes de publicar

Ejecuta:

```bash
npm.cmd run build
```

La carpeta generada es:

```txt
dist
```

## Vercel

1. Sube el proyecto a GitHub.
2. En Vercel, selecciona `Add New Project`.
3. Conecta el repositorio.
4. Usa estos valores:

```txt
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

El archivo `vercel.json` ya esta configurado para que las rutas de React Router funcionen al recargar la pagina.

## Netlify

1. Sube el proyecto a GitHub.
2. En Netlify, selecciona `Add new site`.
3. Conecta el repositorio.
4. Usa estos valores:

```txt
Build Command: npm run build
Publish Directory: dist
```

El archivo `public/_redirects` ya esta configurado para que las rutas de React Router funcionen al recargar la pagina.

## Importante

Los datos actuales se guardan en `localStorage`. Esto significa que:

- Cada navegador tendra sus propios datos.
- Los datos no se comparten entre computadores.
- Si limpias el navegador, puedes perder datos.

Para produccion real con varios usuarios compartiendo informacion, el siguiente paso es conectar backend y base de datos.
