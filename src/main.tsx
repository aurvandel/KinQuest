import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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
      })
      .catch((error) => {
        console.log('[PWA] Service Worker registration failed:', error);
      });
  });
  
  // Handle service worker updates
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[PWA] Service Worker updated, reload may be needed');
  });
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
