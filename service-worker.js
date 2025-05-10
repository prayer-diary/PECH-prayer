// Service Worker for PECH Prayer Diary PWA

// Cache version - update this number to force refresh of caches
const CACHE_VERSION = '1.1.057';
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
  '/img/icons/ios/192.png',
  '/img/icons/ios/512.png',
  '/img/icons/ios/180.png',
  '/img/icons/ios/72.png',  // Added for badge icon
  '/img/icons/android/notification_icon.png'  // Android-specific notification icon
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

// Enhanced Push event handler - FIXED: No longer informs clients immediately
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);
  
  if (event.data) {
    try {
      // Parse the push data
      const pushData = event.data.json();
      
      // Log the received notification data
      console.log('[Service Worker] Push notification data:', pushData);
      
      // Detect Android platform
      const isAndroid = /android/i.test(self.navigator.userAgent);
      
      // Set notification options based on the push data
      const notificationTitle = pushData.title || 'Prayer Diary';
      
      // Get the proper view ID based on content type
      let viewId = 'calendar-view'; // Default view
      if (pushData.contentType) {
        switch(pushData.contentType.toLowerCase()) {
          case 'prayer_update':
          case 'update':
            viewId = 'updates-view';
            break;
          case 'urgent_prayer':
          case 'urgent':
            viewId = 'urgent-view';
            break;
        }
      }
      
      // Enhanced notification options with Android focus
      const notificationOptions = {
        body: pushData.body || 'New prayer notification',
        // Use platform-specific icons
        icon: isAndroid ? '/img/icons/android/notification_icon.png' : '/img/icons/ios/192.png',
        badge: pushData.badge || '/img/icons/ios/72.png',
        image: pushData.image || null,
        // Enhanced vibration pattern for stronger alerts
        vibrate: pushData.vibrate || [200, 100, 200, 100, 200, 100, 400],
        data: {
          timestamp: Date.now(),
          contentType: pushData.contentType || 'default',
          contentId: pushData.contentId || null,
          viewId: viewId, // Include the calculated viewId
          // Include all original data
          ...pushData.data || {}
        },
        // Android settings for heads-up notifications
        requireInteraction: true,
        // Using a unique tag with timestamp to prevent grouping and ensure delivery
        tag: `prayer-diary-${pushData.contentType || 'notification'}-${Date.now()}`,
        renotify: true,
        actions: [
          {
            action: 'view',
            title: 'View'
          },
          {
            action: 'dismiss',
            title: 'Dismiss'
          }
        ],
        // Critical for Android heads-up notifications - changed to max priority
        importance: 'high',
        priority: 'max',
        silent: false,
        // Set sound explicitly for Android
        sound: 'default'
      };
      
      console.log('[Service Worker] Showing notification with options:', notificationOptions);
      
      // Wait until the notification is shown
      event.waitUntil(
        self.registration.showNotification(notificationTitle, notificationOptions)
          .then(() => {
            console.log('[Service Worker] Notification shown successfully');
            
            // FIXED: Removed the code that immediately sends messages to clients
            // Let the notificationclick event handle user interaction
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
          icon: '/img/icons/ios/192.png',
          badge: '/img/icons/ios/72.png'
        })
      );
    }
  } else {
    console.log('[Service Worker] Push event had no data');
  }
});

// Handle notification click and route to correct view
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received:', event);
  
  // Close the notification
  event.notification.close();
  
  // Get the notification data
  const notificationData = event.notification.data || {};
  console.log('[Service Worker] Notification data:', notificationData);
  
  // Track which action was clicked (if any)
  const actionClicked = event.action || 'default';
  
  // If dismiss action was clicked, just close the notification
  if (actionClicked === 'dismiss') {
    console.log('[Service Worker] User dismissed notification, not navigating');
    return;
  }
  
  // Get the viewId directly from notification data if available
  let targetViewId = notificationData.viewId || 'calendar-view';
  let contentId = notificationData.contentId || null;
  let contentType = notificationData.contentType || null;
  
  // Get view name without the "-view" suffix for the URL
  const viewName = targetViewId.replace('-view', '');
  
  // Build a direct URL with hash routing for SPA navigation
  const baseUrl = self.location.origin;
  let targetUrl = new URL('/', baseUrl);
  
  // Change to hash-based routing which is more reliable for SPAs
  targetUrl.hash = `#${viewName}`;
  
  // Add content ID as a separate hash parameter if available
  if (contentId) {
    targetUrl.hash += `/content/${contentId}`;
  }
  
  console.log('[Service Worker] Navigation target URL:', targetUrl.href);
  
  // This function will focus an existing client or open a new window
  const navigateToTarget = async () => {
    try {
      // First try to find existing windows/tabs
      const windowClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      
      // Check if we have any open windows with our origin
      let client = windowClients.find(c => c.url.startsWith(baseUrl));
      
      if (client) {
        // Found an existing client, focus it
        console.log('[Service Worker] Found existing client, focusing and navigating it');
        client = await client.focus();
        
        // IMPORTANT: Now that the user clicked the notification, inform the client
        // about the notification content and where to navigate
        client.postMessage({
          type: 'NOTIFICATION_CLICKED',  // Changed from NOTIFICATION_RECEIVED to NOTIFICATION_CLICKED
          viewId: targetViewId,
          data: notificationData,
          contentId: contentId
        });
        
        // Also post the navigation message
        client.postMessage({
          type: 'NAVIGATE_TO_VIEW',
          viewId: targetViewId,
          data: notificationData
        });
        
        // Also navigate to the URL with hash for fallback
        return client.navigate(targetUrl.href);
      } else {
        // If no existing window/tab, open a new one with the target URL
        console.log('[Service Worker] No existing client found, opening new window');
        
        // Force open to the exact hash URL to ensure it works
        const newClient = await clients.openWindow(targetUrl.href);
        console.log('[Service Worker] New window opened');
        
        // Wait a moment then send the navigation message
        setTimeout(() => {
          if (newClient) {
            // IMPORTANT: First inform about the notification that was clicked
            newClient.postMessage({
              type: 'NOTIFICATION_CLICKED',  // Changed type to be clear this was clicked
              viewId: targetViewId,
              data: notificationData,
              contentId: contentId
            });
            
            // Then send navigation request
            newClient.postMessage({
              type: 'NAVIGATE_TO_VIEW',
              viewId: targetViewId,
              data: notificationData
            });
          }
        }, 1500);
        
        return newClient;
      }
    } catch (error) {
      console.error('[Service Worker] Navigation error:', error);
      
      // Last resort fallback: Try direct window open with minimal URL
      return clients.openWindow(baseUrl + '/#' + viewName);
    }
  };
  
  // Ensure the event waits for our async navigation
  event.waitUntil(navigateToTarget());
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
  
  // Handle client ready notification
  if (event.data && event.data.type === 'CLIENT_READY') {
    console.log('[Service Worker] Client reported ready for navigation');
    
    // If the client sends navigation data along with ready signal
    if (event.data.pendingNavigation) {
      const { viewId, data } = event.data.pendingNavigation;
      
      // Send navigation command back to the ready client
      event.source.postMessage({
        type: 'NAVIGATE_TO_VIEW',
        viewId,
        data
      });
      
      console.log('[Service Worker] Sent pending navigation to ready client:', viewId);
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