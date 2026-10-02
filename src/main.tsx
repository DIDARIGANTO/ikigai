import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter } from './App';
import { ErrorBoundary } from './features/errors/ErrorBoundary';
import { requestPersistOnFirstInteraction } from './data/storage';
import './styles/globals.css';

const router = createAppRouter();

// Просим браузер не стирать данные сам — после первого действия пользователя.
requestPersistOnFirstInteraction();

// Сервис-воркер — только в сборке: в разработке кеш мешал бы видеть правки.
if (import.meta.env.PROD) {
  void import('./features/pwa/registerSW').then(m => m.registerServiceWorker());
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </React.StrictMode>,
);
