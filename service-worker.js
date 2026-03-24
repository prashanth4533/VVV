// VVV Traders Service Worker
// Handles caching and offline support for PWA

const CACHE_NAME = 'vvv-traders-v1';
const urlsToCache = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Nunito:wght@400;600;700;800&display=swap',
  '/offline.html'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✓ VVV Traders cache opened');
        // Cache only the critical files
        return cache.addAll(urlsToCache.map(url => {
          // Skip URLs that might not be available
          if (url.includes('fonts.googleapis') || url === '/offline.html') {
            return url;
          }
          return url;
        }).filter(url => url))
          .catch(err => {
            console.log('Cache addAll skipped some URLs (expected):', err);
            // Continue even if some URLs fail
            return cache.add('/index.html').catch(e => console.log('Index cache failed:', e));
          });
      })
  );
  // Force service worker to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - cache-first strategy
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external API calls (let them go through)
  if (url.origin !== location.origin && !url.hostname.includes('fonts.googleapis')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(response => {
        // Return cached response if available
        if (response) {
          return response;
        }

        // Try to fetch from network
        return fetch(request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache successful responses
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(request, responseToCache);
              });

            return response;
          })
          .catch(error => {
            // Network request failed, try offline page
            console.log('Network request failed:', error);
            
            // For HTML requests, return offline page
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/offline.html')
                .then(response => response || new Response(
                  '<html><body style="font-family:sans-serif;padding:20px;text-align:center;">' +
                  '<h1>📴 You\'re Offline</h1>' +
                  '<p>Please check your internet connection.</p>' +
                  '<p>Some content may still be available from cache.</p>' +
                  '<button onclick="location.reload()">Try Again</button>' +
                  '</body></html>',
                  {
                    headers: { 'Content-Type': 'text/html' }
                  }
                ));
            }
            
            // For other requests, return a basic offline response
            return new Response('Offline - content unavailable', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain',
                'Cache-Control': 'no-store'
              })
            });
          });
      })
  );
});

// Background Sync (optional - for handling offline form submissions)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(
      // Handle syncing pending orders when back online
      Promise.resolve()
    );
  }
});

// Push notifications (optional)
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'New message from VVV Traders',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="192" height="192"%3E%3Crect fill="%23F5C518" width="192" height="192" rx="40"/%3E%3Ctext x="96" y="96" font-size="80" font-weight="900" fill="%231A1A1A" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif"%3EVVV%3C/text%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="96"%3E%3Crect fill="%23F5C518" width="96" height="96"/%3E%3Ctext x="48" y="48" font-size="40" font-weight="900" fill="%231A1A1A" text-anchor="middle" dominant-baseline="central" font-family="Arial"%3EV%3C/text%3E%3C/svg%3E',
    tag: 'vvv-notification',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification('VVV Traders', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        // Check if app is already open
        for (let client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Open app if it's not already open
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

console.log('✓ VVV Traders Service Worker registered');
