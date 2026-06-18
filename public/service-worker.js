const CACHE_VERSION = 'kinquest-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const API_CACHE = `${CACHE_VERSION}-api`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Service Worker] Some static assets could not be cached:', err);
        // Continue even if some assets fail to cache
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== STATIC_CACHE &&
            cacheName !== DYNAMIC_CACHE &&
            cacheName !== IMAGE_CACHE &&
            cacheName !== API_CACHE
          ) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API requests - network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(API_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Return cached response if network fails
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return offline page or error
            return caches.match('/offline.html').catch(() => {
              return new Response('Offline - No cached data available', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/plain'
                })
              });
            });
          });
        })
    );
    return;
  }

  // Image requests - cache-first strategy
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request).then((response) => {
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            const responseToCache = response.clone();
            cache.put(request, responseToCache);
            return response;
          });
        });
      }).catch(() => {
        // Return a placeholder image on failure
        return new Response(
          '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#ddd" width="100" height="100"/></svg>',
          {
            headers: { 'Content-Type': 'image/svg+xml' }
          }
        );
      })
    );
    return;
  }

  // Static assets - cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, responseToCache);
        });
        return response;
      });
    }).catch(() => {
      // Return offline page for navigation requests
      if (request.mode === 'navigate') {
        return caches.match('/offline.html').catch(() => {
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      }
      return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    })
  );
});

// Handle background sync for submissions when offline
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-submissions') {
    event.waitUntil(
      // Try to sync any pending submissions
      syncPendingSubmissions()
    );
  }
});

async function syncPendingSubmissions() {
  try {
    const db = await openIndexedDB();
    const pendingSubmissions = await getPendingSubmissions(db);
    
    for (const submission of pendingSubmissions) {
      try {
        await fetch('/api/verify-submission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: submission.userId,
            itemId: submission.itemId,
            imageBase64: submission.imageBase64,
            userLat: submission.userLat,
            userLng: submission.userLng,
            forceSubmit: submission.forceSubmit,
            submissionId: submission.submissionId,
          })
        });
        await removePendingSubmission(db, submission.id);
      } catch (err) {
        console.error('Failed to sync submission:', err);
      }
    }
  } catch (err) {
    console.error('Background sync failed:', err);
  }
}

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('kinquest_mesh', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('submissions')) {
        db.createObjectStore('submissions', { keyPath: 'id' });
      }
    };
  });
}

function getPendingSubmissions(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['submissions'], 'readonly');
    const store = transaction.objectStore('submissions');
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const now = new Date();
      const retryable = (request.result || []).filter((submission) => {
        if (!submission) return false;
        if (submission.status !== 'queued' && submission.status !== 'failed') return false;
        if (typeof submission.attempts === 'number' && submission.attempts >= 5) return false;
        if (!submission.nextRetryAt) return true;
        return new Date(submission.nextRetryAt) <= now;
      });
      resolve(retryable);
    };
  });
}

function removePendingSubmission(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['submissions'], 'readwrite');
    const store = transaction.objectStore('submissions');
    const getRequest = store.get(id);
    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const submission = getRequest.result;
      if (!submission) {
        resolve();
        return;
      }
      submission.status = 'synced';
      submission.errorMessage = undefined;
      const putRequest = store.put(submission);
      putRequest.onerror = () => reject(putRequest.error);
      putRequest.onsuccess = () => resolve();
    };
  });
}
