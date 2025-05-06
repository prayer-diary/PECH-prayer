// Service Worker for Prayer Diary PWA - Updated with improved error handling and update notification

// Define a version for the app that changes with each significant update
// Note: This should match the version in config.js
const APP_VERSION = '1.0.017'; // Change this version when deploying a new version

// Use APP_VERSION and timestamp for cache busting
const CACHE_NAME = `prayer-diary-${APP_VERSION}-${Date.now()}`;
// Determine base path - for both local dev and GitHub Pages deployment
const BASE_PATH = self.location.pathname.includes('/prayer-diary') ? '/prayer-diary' : '';

const urlsToCache = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
  BASE_PATH + '/manifest.json',
  BASE_PATH + '/css/style.css',
  BASE_PATH + '/css/bootstrap-morph.min.css',
  BASE_PATH + '/js/app.js',
  BASE_PATH + '/js/auth.js',
  BASE_PATH + '/js/ui.js',
  BASE_PATH + '/js/calendar.js',
  BASE_PATH + '/js/updates.js',
  BASE_PATH + '/js/urgent.js',
  BASE_PATH + '/js/profile.js',
  BASE_PATH + '/js/admin.js',
  BASE_PATH + '/js/notifications.js',
  BASE_PATH + '/js/email-test.js',
  BASE_PATH + '/js/config.js',
  BASE_PATH + '/img/placeholder-profile.png',
  BASE_PATH + '/img/logo.png',
  BASE_PATH + '/img/prayer-banner.jpg',
  BASE_PATH + '/img/icons/icon.svg',
  BASE_PATH + '/img/icons/favicon.ico',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.quilljs.com/1.3.6/quill.snow.css',
  'https://cdn.quilljs.com/1.3.6/quill.min.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Install event');
  
  // Force the waiting service worker to become the active service worker immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Use a simpler caching approach - add what we can, ignore failures
        return Promise.allSettled(
          urlsToCache.map(url => {
            // Skip non-HTTP URLs if any are in the list
            if (!url.startsWith('http:') && !url.startsWith('https:') && !url.startsWith('/')) {
              console.warn('Skipping non-HTTP URL in cache list:', url);
              return Promise.resolve();
            }
            
            // Attempt to cache each asset, but don't let failures stop the service worker from installing
            return fetch(url, { mode: 'no-cors' })
              .then(response => {
                if (response.status === 200 || response.type === 'opaque') {
                  try {
                    return cache.put(url, response);
                  } catch (cacheError) {
                    console.warn('Could not cache asset:', url, cacheError.message);
                    return Promise.resolve();
                  }
                }
              })
              .catch(error => {
                console.warn('Could not fetch asset:', url, error.message);
                // Continue despite the error
                return Promise.resolve();
              });
          })
        );
      })
      .catch(error => {
        console.error('Cache opening failed:', error);
      })
  );
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate event');
  
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim().then(() => {
        console.log('[Service Worker] Claimed all clients');
        
        // Notify all clients that the service worker is active
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SW_ACTIVATED',
              version: APP_VERSION
            });
          });
        });
      })
    ])
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', event => {
  // Skip certain requests that shouldn't be cached
  
  // Skip if the request URL doesn't use http/https protocol
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return; // Skip non-HTTP(S) requests like chrome-extension:// URLs
  }
  
  // Skip Supabase API requests
  if (event.request.url.includes('supabase.co')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(
          response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();
            
            // Only cache http/https requests - This is likely line 118 where the error occurs
            if (event.request.url.startsWith('http:') || event.request.url.startsWith('https:')) {
              try {
                caches.open(CACHE_NAME)
                  .then(cache => {
                    try {
                      cache.put(event.request, responseToCache)
                        .catch(putError => {
                          console.warn('Cache put error:', putError.message);
                        });
                    } catch (cacheError) {
                      console.warn('Error in cache.put operation:', cacheError.message);
                    }
                  })
                  .catch(openError => {
                    console.warn('Error opening cache:', openError.message);
                  });
              } catch (error) {
                console.warn('Error in caching block:', error.message);
              }
            } else {
              console.log('Skipping non-HTTP URL for caching:', event.request.url.substring(0, 50) + '...');
            }
              
            return response;
          }
        );
      })
      .catch(error => {
        console.warn('Fetch handler error:', error.message);
        // Fall back to network if anything fails
        return fetch(event.request);
      })
  );
});

// Push notification event
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Received', event);
  
  // Get the base URL based on the service worker scope
  const baseUrl = self.registration.scope;
  
  let notificationData = {
    title: 'Prayer Diary',
    body: 'New prayer update or request',
    icon: `${baseUrl}img/icons/android/android-launchericon-192-192.png`,
    badge: `${baseUrl}img/icons/android/android-launchericon-72-72.png`,
    data: { url: '/' }
  };
  
  // Try to extract the notification data from the push event
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('[Service Worker] Push notification payload:', data);
      
      // Merge with defaults, preserving required fields
      notificationData = {
        ...notificationData,
        ...data,
        // Ensure icon and badge have absolute paths if they don't already
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge
      };
    } catch (e) {
      console.error('[Service Worker] Error parsing push data:', e);
      // Just use default notification data
    }
  }
  
  // Set up notification options with best practices
  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    image: notificationData.image,  // Optional larger image
    data: notificationData.data || { url: '/' },
    tag: notificationData.tag || 'prayer-diary-notification',
    renotify: notificationData.renotify || false,
    requireInteraction: notificationData.requireInteraction || true,
    vibrate: [100, 50, 100, 50, 100],
    actions: notificationData.actions || [
      {
        action: 'view',
        title: 'View'
      }
    ],
    // Ensure it's not silent
    silent: false,
    // These options help with visuals on mobile
    timestamp: notificationData.timestamp || Date.now(),
    dir: 'auto'
  };
  
  console.log('[Service Worker] Showing notification with options:', options);
  
  // CRITICAL: Use waitUntil to keep service worker alive until notification is shown
  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
      .then(() => {
        console.log('[Service Worker] Notification successfully displayed');
        return Promise.resolve();
      })
      .catch(error => {
        console.error('[Service Worker] Error showing notification:', error);
        return Promise.resolve();
      })
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification clicked:', event);
  
  // Close the notification
  event.notification.close();
  
  // Get the action (if any)
  const action = event.action;
  
  // Extract the URL to navigate to
  let url = '/';
  if (event.notification.data && event.notification.data.url) {
    url = event.notification.data.url;
  }
  
  // Add the base path if not already included
  if (!url.startsWith('http') && !url.startsWith('/')) {
    url = `${BASE_PATH}/${url}`;
  } else if (!url.startsWith('http') && !url.startsWith(BASE_PATH)) {
    url = `${BASE_PATH}${url}`;
  }
  
  console.log(`[Service Worker] Opening URL: ${url}`);
  
  // Handle the click event by opening or focusing on the relevant page
  const notificationPromise = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  })
  .then(windowClients => {
    // Check if there is already a window/tab open with the target URL
    let matchingClient = null;
    
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      console.log(`[Service Worker] Checking client: ${client.url} (vs ${url})`);
      
      // If so, just focus it
      if (client.url.includes(url) && 'focus' in client) {
        return client.focus();
      }
      
      // If we didn't find an exact match, save the first client we find
      if (!matchingClient && 'navigate' in client) {
        matchingClient = client;
      }
    }
    
    // If we found a client but not an exact URL match, navigate that client
    if (matchingClient) {
      console.log(`[Service Worker] Navigating existing client to: ${url}`);
      return matchingClient.navigate(url).then(navigatedClient => navigatedClient.focus());
    }
    
    // If not, open a new window/tab
    console.log(`[Service Worker] Opening new window for: ${url}`);
    return clients.openWindow(url);
  })
  .catch(err => {
    console.error('[Service Worker] Error handling notification click:', err);
  });
  
  event.waitUntil(notificationPromise);
});

// Handle messages from the client
self.addEventListener('message', event => {
  console.log('[Service Worker] Received message:', event.data);
  
  if (event.data && event.data.action === 'CHECK_FOR_UPDATES') {
    // Store the version that was last used by the client
    const clientVersion = event.data.version;
    
    // If the current service worker version is different from the client's version
    if (clientVersion && clientVersion !== APP_VERSION) {
      console.log(`Update available: Client is on ${clientVersion}, Service Worker is on ${APP_VERSION}`);
      
      // Notify the client about the update
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE',
            currentVersion: APP_VERSION,
            clientVersion: clientVersion
          });
        });
      });
    } else {
      console.log('No update available or versions match');
    }
  }
  
  // Handle skipWaiting message to force immediate activation
  if (event.data && event.data.action === 'skipWaiting') {
    console.log('[Service Worker] Skip waiting and activate immediately');
    self.skipWaiting();
  }
});