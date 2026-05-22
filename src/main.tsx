// Punto de entrada del frontend.
// Este archivo conecta React con el div #root que existe en index.html.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ReactDOM crea la aplicacion dentro de #root.
// React.StrictMode ayuda en desarrollo a detectar patrones inseguros.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);