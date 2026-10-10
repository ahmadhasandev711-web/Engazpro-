import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

// Manage Service Worker for PWA
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.warn('[PWA] Service Worker registration failed:', error);
        });
    });
  } else {
    // In development mode, unregister any service worker on localhost to prevent caching Vite dev modules
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
        console.log('[PWA] Unregistered development service worker:', registration.scope);
      }
    });
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
