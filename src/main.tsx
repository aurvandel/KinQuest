import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeUmami } from './utils/umami-init';

// Initialize Umami tracking and replay
initializeUmami();

// Suppress a benign ARM/Chromium bug where MessageChannel.port2 returns null
// under GC pressure during rapid state updates (e.g. image upload). React's
// scheduler falls back to setTimeout automatically, so nothing is broken.
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message ?? '';
  if (msg.includes("postMessage") && msg.includes("null")) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered successfully:', registration);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute

        // When a new SW is waiting (i.e. an update downloaded), show a toast
        const notifyUpdate = (sw: ServiceWorker) => {
          sw.addEventListener('statechange', () => {
            if (sw.state === 'activated') {
              showUpdateToast();
            }
          });
        };

        if (registration.waiting) {
          // Already waiting — a previous tab installed the update
          showUpdateToast();
        }

        registration.addEventListener('updatefound', () => {
          const newSW = registration.installing;
          if (newSW) notifyUpdate(newSW);
        });
      })
      .catch((error) => {
        console.log('[PWA] Service Worker registration failed:', error);
      });
  });

  // Reload after the new SW takes control so users get the fresh bundle
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[PWA] New Service Worker activated — reloading for fresh bundle');
    window.location.reload();
  });
}

function showUpdateToast() {
  // Avoid duplicate toasts
  if (document.getElementById('sw-update-toast')) return;

  const toast = document.createElement('div');
  toast.id = 'sw-update-toast';
  toast.style.cssText = [
    'position:fixed', 'bottom:1.5rem', 'left:50%', 'transform:translateX(-50%)',
    'background:#2d2d2d', 'color:#fff', 'padding:0.75rem 1.25rem',
    'border-radius:0.75rem', 'font-size:13px', 'font-weight:600',
    'display:flex', 'align-items:center', 'gap:0.75rem',
    'box-shadow:0 4px 20px rgba(0,0,0,0.3)', 'z-index:9999',
    'animation:slideUp 0.3s ease'
  ].join(';');

  const style = document.createElement('style');
  style.textContent = '@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(1rem)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
  document.head.appendChild(style);

  toast.innerHTML = `
    <span>🔄 New version available</span>
    <button id="sw-reload-btn" style="background:#5a5a40;color:#fff;border:none;border-radius:0.5rem;padding:0.3rem 0.75rem;cursor:pointer;font-size:12px;font-weight:700">Reload</button>
    <button id="sw-dismiss-btn" style="background:transparent;color:#aaa;border:none;cursor:pointer;font-size:14px;line-height:1;padding:0 0.25rem">✕</button>
  `;

  document.body.appendChild(toast);

  document.getElementById('sw-reload-btn')?.addEventListener('click', () => window.location.reload());
  document.getElementById('sw-dismiss-btn')?.addEventListener('click', () => toast.remove());
}

// Handle PWA install prompt
let deferredPrompt: Event | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event for later use
  deferredPrompt = e;
  console.log('[PWA] Install prompt is ready');
  
  // You can show an install button here if needed
  // For now, the browser will show the prompt automatically
});

window.addEventListener('appinstalled', () => {
  console.log('[PWA] KinQuest installed successfully');
  deferredPrompt = null;
});
