// Service Worker for PECH Prayer Diary PWA

// Cache version - update this number to force refresh of caches
const CACHE_VERSION = '1.1.000';
const CACHE_NAME = `prayer-diary-cache-${CACHE_VERSION}`;

// App shell files to cache initially
const APP_SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/css/bootstrap-morph.min.css',
  '/css/mobile-nav.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/calendar.js',
  '/js/updates.js',
  '/js/urgent.js',
  '/js/profile.js',
  '/js/topics.js',
  '/js/push-notifications.js',
  '/js/config.js',
  '/img/logo.png',
  '/img/placeholder-profile.png',
  '/img/icons/ios/192.png', // Using more generic iOS icon instead of Android-specific
  '/img/icons/ios/512.png',
  '/img/icons/ios/180.png'
];

// URLs to cache on install (in addition to APP_SHELL_FILES)
// These are resources we know will be needed for initial app load
const INITIAL_CACHE_URLS = [
  // CDN resources
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css',
  'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.min.js'
];

// Resources that should not be cached
const NO_CACHE_URLS = [
  '/supabase',
  'functions.supabase.co',
  'supabase.co'
];

// Current version of the service worker
const CURRENT_VERSION = CACHE_VERSION;

// Install event - cache the app shell files
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing new version:', CURRENT_VERSION);
  
  // Skip waiting - activate immediately
  self.skipWaiting();
  
  // Cache app shell and initial resources
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell and initial resources');
      // Add all APP_SHELL_FILES to cache
      return cache.addAll([...APP_SHELL_FILES, ...INITIAL_CACHE_URLS])
        .then(() => {
          console.log('[Service Worker] Successfully cached app shell and initial resources');
        })
        .catch((error) => {
          console.error('[Service Worker] Error caching app shell files:', error);
          // Continue even if some files fail to cache
          return Promise.resolve();
        });
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating new version:', CURRENT_VERSION);
  
  // Take control of all clients
  event.waitUntil(
    clients.claim().then(() => {
      // Cleanup old caches
      return caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName.startsWith('prayer-diary-cache-')) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      });
    }).then(() => {
      // Notify all clients that service worker is activated
      return self.clients.matchAll().then((clients) => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: CURRENT_VERSION
          });
        });
      });
    })
  );
  
  // Ensure this event completes
  event.waitUntil(self.clients.claim());
});

// Fetch event - network-first strategy for API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests (like Supabase API)
  const url = new URL(event.request.url);
  
  // Skip the fetch event for no-cache URLs (API requests, etc.)
  if (shouldNotCache(event.request)) {
    return;
  }
  
  // For GET requests of static assets, use cache-first strategy
  if (event.request.method === 'GET' && isStaticAsset(event.request)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Return cached response if available
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise, fetch from network and cache
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response to cache it and return it
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          
          return response;
        }).catch((error) => {
          console.error('[Service Worker] Fetch failed:', error);
          // Could return a fallback response here if needed
        });
      })
    );
  } else {
    // For other requests, use network-first strategy
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
  }
});

// Push event handler - show notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);
  
  if (event.data) {
    try {
      // Parse the push data
      const pushData = event.data.json();
      
      // Log the received notification data
      console.log('[Service Worker] Push notification data:', pushData);
      
      // Set notification options based on the push data
      const notificationTitle = pushData.title || 'Prayer Diary';
      
      const notificationOptions = {
        body: pushData.body || 'New prayer notification',
        icon: pushData.icon || '/img/icons/ios/192.png', // Default to generic iOS icon
        badge: pushData.badge || '/img/icons/ios/72.png',
        image: pushData.image || null,
        vibrate: pushData.vibrate || [100, 50, 100],
        data: pushData.data || {},
        requireInteraction: pushData.requireInteraction || true,
        actions: pushData.actions || [
          {
            action: 'view',
            title: 'View'
          }
        ],
        tag: pushData.tag || 'prayer-diary-notification',
        renotify: pushData.renotify || true
      };
      
      // Wait until the notification is shown
      event.waitUntil(
        self.registration.showNotification(notificationTitle, notificationOptions)
          .then(() => {
            console.log('[Service Worker] Notification shown successfully');
            
            // After showing the notification, you might want to update some state or database
            // through a fetch request to your API if needed
          })
          .catch(error => {
            console.error('[Service Worker] Error showing notification:', error);
          })
      );
    } catch (error) {
      console.error('[Service Worker] Error processing push event:', error);
      
      // Fallback to a simple notification in case of error
      event.waitUntil(
        self.registration.showNotification('Prayer Diary', {
          body: 'New notification from Prayer Diary',
          icon: '/img/icons/ios/192.png'
        })
      );
    }
  } else {
    console.log('[Service Worker] Push event had no data');
  }
});

// Notification click event - open the app or specific page
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received:', event);
  
  // Close the notification
  event.notification.close();
  
  // Handle notification actions
  let targetUrl = '/';
  
  if (event.action === 'view' && event.notification.data && event.notification.data.url) {
    targetUrl = event.notification.data.url;
  } else if (event.notification.data && event.notification.data.url) {
    // Default action when clicking the notification body
    targetUrl = event.notification.data.url;
  }
  
  // Resolve the target URL to absolute URL
  const baseUrl = self.location.origin;
  const fullUrl = new URL(targetUrl, baseUrl).href;
  
  // Open or focus the target URL in an existing window/tab if possible
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      // Check if there's already a window/tab open with our URL
      const matchingClient = windowClients.find((client) => {
        return client.url === fullUrl || client.url.startsWith(baseUrl);
      });
      
      // If found, focus it and navigate if needed
      if (matchingClient) {
        console.log('[Service Worker] Using existing window');
        
        return matchingClient.focus().then((focusedClient) => {
          // Only navigate if we're not already at the target URL
          if (focusedClient.url !== fullUrl) {
            return focusedClient.navigate(fullUrl);
          }
        });
      }
      
      // Otherwise, open a new window/tab
      console.log('[Service Worker] Opening new window');
      return clients.openWindow(fullUrl);
    })
  );
});

// Listen for messages from the clients
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  // Handle skipWaiting message from clients
  if (event.data && event.data.action === 'skipWaiting') {
    console.log('[Service Worker] Skip waiting requested, activating immediately');
    self.skipWaiting();
  }
  
  // Handle check for updates
  if (event.data && event.data.action === 'CHECK_FOR_UPDATES') {
    const clientVersion = event.data.version;
    
    // If versions don't match, notify client of update
    if (clientVersion !== CURRENT_VERSION) {
      console.log(`[Service Worker] Version mismatch: Client ${clientVersion}, SW ${CURRENT_VERSION}`);
      
      event.source.postMessage({
        type: 'UPDATE_AVAILABLE',
        currentVersion: CURRENT_VERSION,
        clientVersion
      });
    } else {
      console.log(`[Service Worker] Versions match: ${clientVersion}`);
    }
  }
});

// Helper function to check if a request should not be cached
function shouldNotCache(request) {
  const url = new URL(request.url);
  
  // Never cache API requests, authentication, or CORS requests
  if (request.method !== 'GET') {
    return true;
  }
  
  // Check against the NO_CACHE_URLS list
  return NO_CACHE_URLS.some(pattern => url.href.includes(pattern));
}

// Helper function to determine if a request is for a static asset
function isStaticAsset(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Check file extensions for common static assets
  const staticExtensions = [
    '.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', 
    '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot'
  ];
  
  // Check if URL is same origin (same website)
  const isSameOrigin = url.origin === self.location.origin;
  
  // Check if it's a static file extension
  const hasStaticExtension = staticExtensions.some(ext => path.endsWith(ext));
  
  // Check if it's a root page or static directory
  const isRootOrStaticDir = path === '/' || 
                          path === '/index.html' || 
                          path.startsWith('/css/') || 
                          path.startsWith('/js/') || 
                          path.startsWith('/img/');
  
  // Consider it static if it's same origin and either has a static extension or is a root/static directory
  return isSameOrigin && (hasStaticExtension || isRootOrStaticDir);
}