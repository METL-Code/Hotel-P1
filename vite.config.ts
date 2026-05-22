// Configuracion de Vite para desarrollo.
// Vite levanta el frontend y redirige las llamadas /api hacia el backend local.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Activa soporte de React y JSX.
  plugins: [react()],
  server: {
    // Puerto donde se abre la pagina del frontend.
    port: 3000,
    // Abre el navegador automaticamente al iniciar npm run dev.
    open: true,
    // Todo lo que empiece por /api se envia a http://localhost:4000.
    // Aqui se ve cuando LoginPage llama /api/auth/login.
    proxy: {
      '/api': 'http://localhost:4000'
    }
  }
});