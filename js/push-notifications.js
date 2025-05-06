// Push Notifications Module
// Manages push notification subscriptions and permissions

// Constants
const PERMISSION_PROMPT_KEY = 'pushNotificationPermissionPromptShown';
const PERMISSION_PROMPT_DELAY = 3000; // 3 seconds
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const IS_STANDALONE = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

// Variable to track if initialization has been done
let pushInitialized = false;

// Initialize push notification functionality
document.addEventListener('DOMContentLoaded', setupPushNotificationListeners);

// When user logs in, initialize push notifications
document.addEventListener('login-state-changed', function(event) {
  if (event.detail && event.detail.loggedIn) {
    // Call after a short delay to ensure profile is loaded
    setTimeout(initializePushNotifications, 2000);
  }
});

// Set up listeners for the notification permission UI
function setupPushNotificationListeners() {
  // Set up permission prompt listeners
  setupPermissionPromptListeners();
  
  // Listen for changes in user preferences
  document.addEventListener('user-preferences-changed', function(event) {
    if (event.detail && event.detail.notificationMethod === 'push') {
      requestNotificationPermission();
    }
  });
}

// Initialize push notifications at app startup
async function initializePushNotifications() {
  // Prevent multiple initializations
  if (pushInitialized) {
    console.log('Push notifications already initialized');
    return;
  }
  
  try {
    console.log('Initializing push notifications');
    
    // iOS-specific early check
    if (IS_IOS && !IS_STANDALONE) {
      console.log('iOS device detected but not in standalone mode, skipping push initialization');
      return;
    }
    
    // Wait for auth to be stable before checking user preferences
    await waitForAuthStability();
    
    // Only proceed if the user is logged in and has a profile
    if (!isLoggedIn() || !userProfile) {
      console.log('User not logged in or profile not loaded, skipping push initialization');
      return;
    }
    
    // Check if user has opted for push notifications
    if (userProfile.notification_method === 'push') {
      console.log('User has opted for push notifications, checking subscription');
      
      // Check if push is supported in this browser
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported in this browser');
        return;
      }
      
      // Check permission state
      const permission = Notification.permission;
      if (permission === 'denied') {
        console.log('Push permission denied by user');
        // Consider updating the user profile to disable push if permission denied
        return;
      }
      
      // Only proceed if permission is granted
      if (permission === 'granted') {
        // Ensure the service worker is registered and activated
        await ensureServiceWorkerReady();
        
        // Now get the service worker registration
        const registration = window.swRegistration || await navigator.serviceWorker.ready;
        
        if (!registration || !registration.active) {
          console.error('No active service worker found');
          return;
        }
        
        console.log('Service worker is active:', registration.active.state);
        
        // Check existing subscription
        let subscription = await registration.pushManager.getSubscription();
        
        // If no subscription exists or it needs to be renewed, create a new one
        if (!subscription) {
          console.log('No existing push subscription, creating new one');
          
          // Get VAPID key from server
          const vapidPublicKey = await getVapidPublicKey();
          
          try {
            // Create new subscription
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });
            
            console.log('Push subscription created successfully');
            
            // Save the new subscription to database
            await saveSubscriptionToDatabase(subscription);
          } catch (subscribeError) {
            console.error('Failed to subscribe to push:', subscribeError);
            return;
          }
        } else {
          console.log('Existing push subscription found, updating database');
          // Update the existing subscription in the database
          await saveSubscriptionToDatabase(subscription);
        }
        
        pushInitialized = true;
        console.log('Push notification initialization complete');
      } else {
        // Ask for permission if not yet granted
        console.log('Permission not granted, requesting permission');
        requestNotificationPermission();
      }
    } else {
      console.log('User has not opted for push notifications, skipping initialization');
    }
  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
}

// Helper function to ensure the service worker is registered and active
async function ensureServiceWorkerReady() {
  return new Promise(async (resolve, reject) => {
    try {
      // If we already have a global registration with active service worker, use it
      if (window.swRegistration && window.swRegistration.active) {
        console.log('[Push] Using existing active service worker registration');
        resolve(window.swRegistration);
        return;
      }
      
      // If navigator.serviceWorker.controller exists, a service worker is controlling this page
      if (navigator.serviceWorker.controller) {
        console.log('[Push] Page is already controlled by service worker');
        
        // Get the registration for the controller
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          window.swRegistration = registration;
          resolve(registration);
          return;
        }
      }
      
      // If we reach here, we need to register or ensure a service worker
      console.log('[Push] Ensuring service worker is registered and active');
      
      // Use the app's registration function if available
      if (typeof registerServiceWorkerWithPushSupport === 'function') {
        try {
          const registration = await registerServiceWorkerWithPushSupport();
          console.log('[Push] Service worker registered via app function');
          resolve(registration);
          return;
        } catch (regError) {
          console.error('[Push] Error registering service worker via app function:', regError);
          // Continue with our own registration logic as backup
        }
      }
      
      // Our own registration logic as backup
      const swPath = window.location.pathname.includes('/PECH-prayer') ? 
                    '/PECH-prayer/service-worker.js' : 
                    '/service-worker.js';
      const swScope = window.location.pathname.includes('/PECH-prayer') ? 
                     '/PECH-prayer/' : 
                     '/';
      
      console.log('[Push] Registering service worker at:', swPath);
      
      // Setup activation message listener
      const activationMessagePromise = new Promise(messageResolve => {
        const messageHandler = event => {
          if (event.data && event.data.type === 'SW_ACTIVATED') {
            console.log('[Push] Received SW_ACTIVATED message');
            navigator.serviceWorker.removeEventListener('message', messageHandler);
            messageResolve();
          }
        };
        
        navigator.serviceWorker.addEventListener('message', messageHandler);
      });
      
      // Register the service worker
      const registration = await navigator.serviceWorker.register(swPath, { scope: swScope });
      window.swRegistration = registration;
      
      // If already active, we're good
      if (registration.active) {
        console.log('[Push] Service worker is already active');
        resolve(registration);
        return;
      }
      
      // Wait for activation
      if (registration.installing) {
        console.log('[Push] Service worker is installing, waiting for activation');
        
        // Combination of statechange and message events
        const activationPromise = new Promise(stateResolve => {
          registration.installing.addEventListener('statechange', event => {
            if (event.target.state === 'activated') {
              console.log('[Push] Service worker activated via statechange');
              stateResolve();
            }
          });
        });
        
        // Wait for either activation method with a timeout
        await Promise.race([
          activationPromise,
          activationMessagePromise,
          new Promise(timeout => setTimeout(timeout, 5000))
        ]);
        
        // At this point either we've activated or timed out
        if (registration.active) {
          console.log('[Push] Service worker is now active');
          resolve(registration);
        } else {
          console.warn('[Push] Service worker activation timeout, continuing anyway');
          resolve(registration);
        }
      } else if (registration.waiting) {
        console.log('[Push] Service worker is waiting, sending skipWaiting message');
        
        // Send skipWaiting message
        registration.waiting.postMessage({ action: 'skipWaiting' });
        
        // Wait for controller change with timeout
        const controllerChangePromise = new Promise(controllerResolve => {
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[Push] Controller changed, service worker should be active');
            controllerResolve();
          }, { once: true });
        });
        
        await Promise.race([
          controllerChangePromise,
          activationMessagePromise,
          new Promise(timeout => setTimeout(timeout, 5000))
        ]);
        
        // By now we should have an active service worker
        resolve(registration);
      } else {
        console.warn('[Push] No installing or waiting worker found');
        resolve(registration);
      }
    } catch (error) {
      console.error('[Push] Error ensuring service worker is ready:', error);
      reject(error);
    }
  });
}

// Request notification permission
async function requestNotificationPermission() {
  // Check if notifications are supported
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    showNotification('Not Supported', 'Notifications are not supported in this browser.', 'warning');
    return false;
  }
  
  // Check if we're on iOS
  if (IS_IOS) {
    // Apple requires PWAs to be in standalone mode (installed) for notifications
    if (!IS_STANDALONE) {
      console.log('iOS device detected but not in standalone mode');
      
      // Show special iOS install prompt
      showIOSInstallInstructions();
      return false;
    }
    
    // iOS Safari has limited notification support
    if (Notification.permission === 'denied') {
      console.log('Notification permission previously denied on iOS');
      showIOSNotificationHelp();
      return false;
    }
  }
  
  // If permission already granted, we're good
  if (Notification.permission === 'granted') {
    console.log('Notification permission already granted');
    return true;
  }
  
  // If permission denied (non-iOS case, since we handled iOS above)
  if (Notification.permission === 'denied') {
    console.log('Notification permission previously denied');
    showNotificationHelp();
    return false;
  }
  
  try {
    // Show custom permission prompt first for better UX
    const shouldProceed = await showCustomPermissionPrompt();
    
    if (shouldProceed) {
      // Request browser permission
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('Notification permission granted!');
        
        // Now that we have permission, we can subscribe
        await subscribeToPushNotifications();
        return true;
      } else {
        console.log('Notification permission not granted:', permission);
        return false;
      }
    } else {
      console.log('User declined custom permission prompt');
      return false;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    
    // Special handling for iOS permission errors
    if (IS_IOS) {
      showIOSNotificationHelp();
    }
    
    return false;
  }
}

// Show a custom permission prompt to improve user experience
function showCustomPermissionPrompt() {
  return new Promise((resolve) => {
    // Check if we've shown this prompt before
    const promptShown = localStorage.getItem(PERMISSION_PROMPT_KEY);
    if (promptShown) {
      // If we've shown it before, just proceed to browser prompt
      resolve(true);
      return;
    }
    
    // Create a custom prompt element
    const promptElement = document.createElement('div');
    promptElement.className = 'notification-permission-prompt';
    promptElement.innerHTML = `
      <h5><i class="bi bi-bell me-2"></i>Enable Notifications?</h5>
      <p>Allow notifications to receive alerts when new prayer updates and urgent prayer requests are added.</p>
      <div class="actions">
        <button id="notification-later-btn" class="btn btn-sm btn-outline-secondary">Ask Later</button>
        <button id="notification-allow-btn" class="btn btn-sm btn-primary">Allow</button>
      </div>
    `;
    
    // Add to document
    document.body.appendChild(promptElement);
    
    // Animate in
    setTimeout(() => {
      promptElement.classList.add('show');
    }, 100);
    
    // Add button listeners
    document.getElementById('notification-allow-btn').addEventListener('click', () => {
      // Mark prompt as shown
      localStorage.setItem(PERMISSION_PROMPT_KEY, 'true');
      // Remove the prompt
      promptElement.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(promptElement);
      }, 300);
      // Resolve with true to proceed with browser prompt
      resolve(true);
    });
    
    document.getElementById('notification-later-btn').addEventListener('click', () => {
      // Remove the prompt without marking it as shown permanently
      promptElement.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(promptElement);
      }, 300);
      // Resolve with false to cancel
      resolve(false);
    });
  });
}

// Setup permission prompt listeners
function setupPermissionPromptListeners() {
  // We'll use standard click handlers which will be set up on the elements
  // when they're created in showCustomPermissionPrompt
}

// Show iOS-specific notification help
function showIOSNotificationHelp() {
  const content = `
    <p>Notification permissions are currently blocked for this app on your iOS device.</p>
    <h6 class="mt-3 mb-2">To enable notifications:</h6>
    <ol>
      <li>Open the <strong>Settings</strong> app on your iPhone or iPad</li>
      <li>Scroll down and find <strong>Safari</strong></li>
      <li>Tap on <strong>Advanced</strong> → <strong>Website Data</strong></li>
      <li>Find and remove data for this website</li>
      <li>Return to the app and try again</li>
    </ol>
    <p class="mt-2"><strong>Note:</strong> iOS has limited support for web notifications, even in installed PWAs.</p>
  `;
  
  showNotification('iOS Notifications', content);
}

// Show iOS-specific installation instructions
function showIOSInstallInstructions() {
  const content = `
    <p>Push notifications on iOS require the app to be installed to your home screen first.</p>
    <h6 class="mt-3 mb-2">To install this app:</h6>
    <ol>
      <li>Tap the <strong>Share</strong> button in Safari's toolbar</li>
      <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
      <li>Confirm by tapping <strong>Add</strong></li>
      <li>Launch the app from your home screen</li>
      <li>Then try enabling notifications again</li>
    </ol>
    <p class="mt-3 small text-muted">Apple requires web apps to be installed before they can request notification permissions.</p>
  `;
  
  showNotification('Installation Required', content);
}

// Show help for re-enabling notifications (standard browsers)
function showNotificationHelp() {
  const content = `
    <p>You previously blocked notifications for this site. To receive prayer notifications, you'll need to change your browser settings.</p>
    <h6 class="mt-3 mb-2">How to enable notifications:</h6>
    <ol>
      <li>Click the lock/info icon in your browser's address bar</li>
      <li>Find "Notifications" or "Permissions" settings</li>
      <li>Change from "Block" to "Allow"</li>
      <li>Refresh this page</li>
    </ol>
  `;
  
  // Show a notification with instructions
  showNotification('Notifications Blocked', content);
}

// Subscribe to push notifications after permission is granted
async function subscribeToPushNotifications() {
  try {
    console.log('Setting up push notification subscription');
    
    // Check if service worker is supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported on this browser');
      return false;
    }
    
    // Ensure service worker is registered and active before proceeding
    await ensureServiceWorkerReady();
    
    // Get the service worker registration - use global registration if available
    const registration = window.swRegistration || await navigator.serviceWorker.ready;
    console.log('Service worker ready with scope:', registration.scope);
    
    if (!registration || !registration.active) {
      console.error('No active service worker found, cannot subscribe to push');
      return false;
    }
    
    // Get the VAPID public key from the server
    const vapidPublicKey = await getVapidPublicKey();
    console.log('VAPID public key retrieved successfully');
    
    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();
    
    // If subscription exists but might be expired, unsubscribe first
    if (subscription) {
      console.log('Existing subscription found, checking if valid...');
      try {
        // Try a simple operation to check validity
        const endpoint = subscription.endpoint;
        console.log('Subscription appears valid. Endpoint:', endpoint.substring(0, 30) + '...');
      } catch (e) {
        console.log('Existing subscription appears invalid, unsubscribing...');
        await subscription.unsubscribe();
        subscription = null;
      }
    }
    
    // Create a new subscription if needed
    if (!subscription) {
      console.log('Creating new push subscription...');
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
        console.log('New push subscription created successfully');
      } catch (subError) {
        console.error('Failed to create push subscription:', subError);
        if (Notification.permission === 'denied') {
          console.log('Permission denied for notifications');
        }
        return false;
      }
    }
    
    // Save subscription to database
    const saved = await saveSubscriptionToDatabase(subscription);
    if (saved) {
      console.log('Push subscription saved to server successfully');
    } else {
      console.error('Failed to save push subscription to server');
    }
    
    return saved;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return false;
  }
}

// Save the subscription to the database
async function saveSubscriptionToDatabase(subscription) {
  try {
    // Wait for auth stability
    await waitForAuthStability();
    
    // Check if we have a valid user ID
    const userId = getUserId();
    if (!userId) {
      console.error('Cannot save subscription: No user ID available');
      return false;
    }
    
    // Convert subscription to JSON
    const subscriptionJSON = subscription.toJSON();
    
    // First check if a subscription already exists for this user
    const { data: existingSubscription, error: queryError } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .single();
      
    if (queryError && queryError.code !== 'PGRST116') { // Not found error is okay
      console.error('Error checking existing subscription:', queryError);
      return false;
    }
    
    if (existingSubscription) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({
          subscription_data: subscriptionJSON,
          active: true,  // Mark as active when updating
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubscription.id);
        
      if (updateError) {
        console.error('Error updating subscription:', updateError);
        return false;
      }
    } else {
      // Insert new subscription
      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: userId,
          subscription_data: subscriptionJSON,
          active: true,  // Set as active on creation
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      if (insertError) {
        console.error('Error saving subscription:', insertError);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error in saveSubscriptionToDatabase:', error);
    return false;
  }
}

// Get the VAPID public key from the server
async function getVapidPublicKey() {
  try {
    // Try to get from localStorage first if available
    const cachedKey = localStorage.getItem('vapidPublicKey');
    if (cachedKey) {
      return cachedKey;
    }
    
    // Call Supabase Edge Function to get VAPID key
    const { data, error } = await supabase.functions.invoke('get-vapid-key');
    
    if (error) {
      console.error('Error getting VAPID key:', error);
      throw error;
    }
    
    if (data && data.vapidPublicKey) {
      // Cache the key for future use
      localStorage.setItem('vapidPublicKey', data.vapidPublicKey);
      return data.vapidPublicKey;
    } else {
      throw new Error('Invalid response from get-vapid-key function');
    }
  } catch (error) {
    console.error('Failed to get VAPID key:', error);
    throw error;
  }
}

// Helper function to convert base64 to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Update profile notification settings when permissions change
async function updateProfileNotificationSettings(newMethod = 'none') {
  try {
    await waitForAuthStability();
    
    const userId = getUserId();
    if (!userId) return false;
    
    // Update user's notification method preference
    const { error } = await supabase
      .from('profiles')
      .update({ notification_method: newMethod })
      .eq('id', userId);
      
    if (error) {
      console.error('Error updating notification preferences:', error);
      return false;
    }
    
    // Update local profile data if available
    if (window.userProfile) {
      window.userProfile.notification_method = newMethod;
    }
    
    return true;
  } catch (error) {
    console.error('Error in updateProfileNotificationSettings:', error);
    return false;
  }
}

// Test push notifications (for debugging)
async function testPushNotification() {
  try {
    console.log('Sending test push notification...');
    
    // Make sure we have an active service worker
    await ensureServiceWorkerReady();
    
    const { data, error } = await supabase.functions.invoke('send-push-notifications', {
      body: {
        userIds: [getUserId()],
        title: 'Prayer Diary Test',
        message: 'This is a test notification from Prayer Diary. It should appear as a popup notification.',
        contentType: 'test',
        contentId: '00000000-0000-0000-0000-000000000000',
        data: {
          url: '/calendar-view',
          timestamp: Date.now()
        },
        // Visual properties to ensure proper display
        requireInteraction: true,
        renotify: true,
        vibrate: [100, 50, 100, 50, 100, 50, 100],
        tag: 'PECH-prayer-test-' + Date.now()
      }
    });
    
    if (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
    
    console.log('Test notification result:', data);
    return true;
  } catch (error) {
    console.error('Error in testPushNotification:', error);
    return false;
  }
}

// Unsubscribe from push notifications
async function unsubscribeFromPushNotifications() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }
    
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;
    
    // Get current subscription
    const subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      console.log('No push subscription found to unsubscribe from');
      return true;
    }
    
    // Unsubscribe
    const result = await subscription.unsubscribe();
    
    if (result) {
      console.log('Successfully unsubscribed from push notifications');
      
      // Mark as inactive in database
      await markSubscriptionInactive();
    }
    
    return result;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return false;
  }
}

// Mark a subscription as inactive in the database
async function markSubscriptionInactive() {
  try {
    await waitForAuthStability();
    
    const userId = getUserId();
    if (!userId) return false;
    
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ active: false })
      .eq('user_id', userId);
      
    if (error) {
      console.error('Error marking subscription as inactive:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in markSubscriptionInactive:', error);
    return false;
  }
}

// Export functions for use in other modules
window.requestNotificationPermission = requestNotificationPermission;
window.testPushNotification = testPushNotification;
window.unsubscribeFromPushNotifications = unsubscribeFromPushNotifications;