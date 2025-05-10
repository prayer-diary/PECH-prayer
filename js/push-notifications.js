// Push Notifications Module
// Manages push notification subscriptions and permissions

// Constants - Use window namespacing to avoid redeclaration issues
window.PUSH_NOTIFICATION = window.PUSH_NOTIFICATION || {};
window.PUSH_NOTIFICATION.PERMISSION_PROMPT_KEY = 'pushNotificationPermissionPromptShown';
window.PUSH_NOTIFICATION.PERMISSION_PROMPT_DELAY = 3000; // 3 seconds
window.PUSH_NOTIFICATION.IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
window.PUSH_NOTIFICATION.IS_ANDROID = /Android/.test(navigator.userAgent);

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

// Get iOS version information
function getIOSVersion() {
  if (!window.PUSH_NOTIFICATION.IS_IOS) return null;
  
  const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
  return match ? {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3] || 0, 10)
  } : null;
}

// Check if iOS version supports push API (16.4+)
function isIOSVersionSupported() {
  const version = getIOSVersion();
  if (!version) return false;
  
  // Push API is supported from iOS 16.4+
  return (version.major > 16) || (version.major === 16 && version.minor >= 4);
}

// More reliable standalone mode detection for iOS
function isIOSStandalone() {
  if (window.PUSH_NOTIFICATION.IS_IOS) {
    // For iOS devices, navigator.standalone is the reliable property
    return !!window.navigator.standalone;
  }
  
  // For other platforms, use the display-mode media query
  return window.matchMedia('(display-mode: standalone)').matches;
}

// Enhanced function to check if device is in standalone mode
window.isInStandaloneMode = function isInStandaloneMode() {
  // Check multiple conditions to detect standalone mode
  const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const navigatorStandalone = window.navigator.standalone; // iOS Safari
  const androidApp = document.referrer.includes('android-app://');
  const installedFlag = localStorage.getItem('prayerDiaryInstalled') === 'true';
  
  // Log the detected mode for debugging
  console.log('Mode detection:', {
    displayModeStandalone,
    navigatorStandalone,
    androidApp,
    installedFlag
  });
  
  return displayModeStandalone || navigatorStandalone || androidApp || installedFlag;
}

// Advanced device debug logging
function logDeviceDebugInfo() {
  // Create a comprehensive device and environment report
  const debugInfo = {
    device: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      isIOS: window.PUSH_NOTIFICATION.IS_IOS,
      isAndroid: window.PUSH_NOTIFICATION.IS_ANDROID,
      standalone: window.navigator.standalone,
      displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
      installedFlag: localStorage.getItem('prayerDiaryInstalled') === 'true',
      language: navigator.language
    },
    features: {
      serviceWorkerSupported: 'serviceWorker' in navigator,
      pushManagerSupported: 'PushManager' in window,
      notificationSupported: 'Notification' in window,
      notificationPermission: Notification.permission
    },
    app: {
      version: window.PRAYER_DIARY ? window.PRAYER_DIARY.version : 'unknown',
      devMode: window.PRAYER_DIARY ? window.PRAYER_DIARY.devMode : false
    }
  };
  
  // Add iOS-specific information if on iOS
  if (window.PUSH_NOTIFICATION.IS_IOS) {
    const iosVersion = getIOSVersion();
    debugInfo.ios = {
      version: iosVersion ? `${iosVersion.major}.${iosVersion.minor}.${iosVersion.patch}` : 'Unknown',
      isVersionSupported: isIOSVersionSupported(),
      isStandalone: isIOSStandalone()
    };
  }
  
  // Add Android-specific information if on Android
  if (window.PUSH_NOTIFICATION.IS_ANDROID) {
    // Extract Android version
    const match = navigator.userAgent.match(/Android (\d+)\.(\d+)\.?(\d+)?/);
    debugInfo.android = {
      version: match ? `${match[1]}.${match[2]}.${match[3] || 0}` : 'Unknown',
      manufacturer: getAndroidManufacturer()
    };
  }
  
  console.log('Device Debug Information:', debugInfo);
  return debugInfo;
}

// Get Android manufacturer from user agent
function getAndroidManufacturer() {
  const ua = navigator.userAgent;
  
  // Common Android manufacturers and their identifiers in UA
  const manufacturers = [
    { name: 'Samsung', pattern: /samsung/i },
    { name: 'Google', pattern: /pixel|google/i },
    { name: 'Huawei', pattern: /huawei/i },
    { name: 'Xiaomi', pattern: /xiaomi|redmi/i },
    { name: 'Oppo', pattern: /oppo/i },
    { name: 'Vivo', pattern: /vivo/i },
    { name: 'OnePlus', pattern: /oneplus/i },
    { name: 'Motorola', pattern: /moto/i },
    { name: 'LG', pattern: /lg/i },
    { name: 'Sony', pattern: /sony|xperia/i }
  ];
  
  for (const manufacturer of manufacturers) {
    if (manufacturer.pattern.test(ua)) {
      return manufacturer.name;
    }
  }
  
  return 'Unknown';
}

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
  
  // Listen for service worker messages
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', function(event) {
      // Handle notification related messages
      if (event.data && event.data.type === 'NOTIFICATION_CLICKED') {
        console.log('Received notification click message from service worker:', event.data);
        // Process notification that was clicked by the user
        processNotificationClick(event.data);
      }
    });
  }
}

// Add this new function to process notification clicks
function processNotificationClick(notificationData) {
  try {
    // Get the view ID and content ID
    const viewId = notificationData.viewId;
    const contentId = notificationData.contentId;
    
    console.log(`Processing notification click: viewId=${viewId}, contentId=${contentId}`);
    
    // Show a toast notification to confirm the user action
    if (typeof showToast === 'function') {
      showToast(
        'Notification',
        `Opening ${viewId.replace('-view', '')} content`,
        'info',
        3000
      );
    }
    
    // Any additional processing for specific notification types can be added here
    // For example, marking a notification as read in the database
    
  } catch (error) {
    console.error('Error processing notification click:', error);
  }
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
    
    // Log comprehensive debug info
    logDeviceDebugInfo();
    
    // Check for iOS version support
    if (window.PUSH_NOTIFICATION.IS_IOS) {
      if (!isIOSVersionSupported()) {
        console.log('iOS version does not support Push API (requires iOS 16.4+)');
        return;
      }
      
      // On iOS, we only proceed if in standalone mode (installed as app)
      // But we use our improved detection method
      if (!isIOSStandalone()) {
        console.log('iOS device detected but not in standalone mode, skipping push initialization');
        showIOSInstallInstructions();
        return;
      }
      
      console.log('iOS device in standalone mode with supported version, continuing with push initialization');
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
        // For Android, make sure the service worker is properly registered and active
        if (window.PUSH_NOTIFICATION.IS_ANDROID) {
          await ensureServiceWorkerRegistered();
        }
        
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
            // Create new subscription with platform-specific options
            const subscriptionOptions = {
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            };
            
            // Add Safari-specific parameters if on iOS
            if (window.PUSH_NOTIFICATION.IS_IOS) {
              // When debugging, explicitly request the prompt
              subscriptionOptions.prompt = true;
            }
            
            subscription = await registration.pushManager.subscribe(subscriptionOptions);
            
            console.log('Push subscription created successfully');
            
            // Save the new subscription to database
            await saveSubscriptionToDatabase(subscription);
          } catch (subscribeError) {
            console.error('Failed to subscribe to push:', subscribeError);
            
            // Check if on iOS and provide specific guidance
            if (window.PUSH_NOTIFICATION.IS_IOS) {
              if (subscribeError.name === 'NotAllowedError') {
                showIOSNotificationHelp();
              } else {
                // Handle other iOS-specific errors
                const errorMessage = `iOS push registration error: ${subscribeError.message}`;
                console.error(errorMessage);
                showNotification('Push Registration Failed', errorMessage, 'error');
              }
            }
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

// Ensure the service worker is registered correctly (especially for Android)
async function ensureServiceWorkerRegistered() {
  try {
    // Skip if service worker is not supported
    if (!('serviceWorker' in navigator)) {
      console.error('Service Worker not supported in this browser');
      return null;
    }
    
    // Check if we already have a registration stored
    if (window.swRegistration && window.swRegistration.active) {
      console.log('Using existing service worker registration');
      return window.swRegistration;
    }
    
    // Determine the service worker path
    const swPath = window.location.pathname.includes('/PECH-prayer') 
      ? '/PECH-prayer/service-worker.js'
      : '/service-worker.js';
      
    const swScope = window.location.pathname.includes('/PECH-prayer')
      ? '/PECH-prayer/'
      : '/';
    
    console.log('Registering service worker with path:', swPath, 'and scope:', swScope);
    
    // Add cache-busting query parameter for Android
    // This helps ensure we always get the latest version
    const cacheBustingPath = `${swPath}?v=${Date.now()}`;
    
    // Register the service worker
    const registration = await navigator.serviceWorker.register(cacheBustingPath, {
      scope: swScope
    });
    
    console.log('Service worker registered successfully');
    
    // If the service worker is installing or waiting, try to activate it
    if (registration.installing || registration.waiting) {
      console.log('Service worker is installing or waiting, attempting to activate');
      
      if (registration.waiting) {
        // Send skipWaiting message to the waiting service worker
        registration.waiting.postMessage({ action: 'skipWaiting' });
      }
      
      // Wait for the service worker to activate
      await new Promise((resolve) => {
        const listener = (event) => {
          if (event.target.state === 'activated') {
            registration.removeEventListener('statechange', listener);
            resolve();
          }
        };
        
        if (registration.installing) {
          registration.installing.addEventListener('statechange', listener);
        } else if (registration.waiting) {
          registration.waiting.addEventListener('statechange', listener);
        } else {
          resolve(); // Already activated
        }
      });
      
      // Wait for controller change event which indicates the service worker has taken control
      await navigator.serviceWorker.ready;
    }
    
    // Store the registration globally
    window.swRegistration = registration;
    
    console.log('Service worker registered and activated');
    return registration;
  } catch (error) {
    console.error('Error ensuring service worker registration:', error);
    return null;
  }
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
  if (window.PUSH_NOTIFICATION.IS_IOS) {
    // Check iOS version first
    if (!isIOSVersionSupported()) {
      console.log('iOS version does not support Push API (requires iOS 16.4+)');
      showNotification('Not Supported', 'Push notifications require iOS 16.4 or later.', 'warning');
      return false;
    }
    
    // Apple requires PWAs to be in standalone mode (installed) for notifications
    if (!isIOSStandalone()) {
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
    if (window.PUSH_NOTIFICATION.IS_IOS) {
      showIOSNotificationHelp();
    }
    
    return false;
  }
}

// Show a custom permission prompt to improve user experience
function showCustomPermissionPrompt() {
  return new Promise((resolve) => {
    // Check if we've shown this prompt before
    const promptShown = localStorage.getItem(window.PUSH_NOTIFICATION.PERMISSION_PROMPT_KEY);
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
      localStorage.setItem(window.PUSH_NOTIFICATION.PERMISSION_PROMPT_KEY, 'true');
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
    <p class="mt-2"><strong>Note:</strong> Push notifications on iOS require iOS 16.4 or later, and the app must be installed to your home screen.</p>
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

// Show Android-specific notification help
function showAndroidNotificationHelp() {
  const content = `
    <p>Notification permissions are currently blocked for this app on your Android device.</p>
    <h6 class="mt-3 mb-2">To enable notifications:</h6>
    <ol>
      <li>Open your device <strong>Settings</strong></li>
      <li>Tap on <strong>Apps</strong> or <strong>Application Manager</strong></li>
      <li>Find this app or your browser in the list</li>
      <li>Tap on <strong>Permissions</strong> or <strong>Notifications</strong></li>
      <li>Enable notifications for this app</li>
      <li>Return to the app and refresh</li>
    </ol>
    <p class="mt-2"><strong>Note:</strong> For the best experience, install this app to your home screen.</p>
  `;
  
  showNotification('Android Notifications', content);
}

// Show help for re-enabling notifications (standard browsers)
function showNotificationHelp() {
  // Show platform-specific help when possible
  if (window.PUSH_NOTIFICATION.IS_ANDROID) {
    showAndroidNotificationHelp();
    return;
  }
  
  // Generic help for other browsers
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
    
    // For Android, ensure service worker is properly registered first
    if (window.PUSH_NOTIFICATION.IS_ANDROID) {
      await ensureServiceWorkerRegistered();
    }
    
    // Get the service worker registration - use global registration if available
    const registration = window.swRegistration || await navigator.serviceWorker.ready;
    console.log('PUSH: Service worker ready with scope:', registration.scope);
    
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
        // Prepare subscription options with platform-specific settings
        const subscriptionOptions = {
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        };
        
        // Add Safari-specific parameters if on iOS
        if (window.PUSH_NOTIFICATION.IS_IOS) {
          // When debugging, explicitly request the prompt
          subscriptionOptions.prompt = true;
        }
        
        subscription = await registration.pushManager.subscribe(subscriptionOptions);
        console.log('New push subscription created successfully');
      } catch (subError) {
        console.error('Failed to create push subscription:', subError);
        
        // Special handling for iOS errors
        if (window.PUSH_NOTIFICATION.IS_IOS) {
          if (subError.name === 'NotAllowedError') {
            showIOSNotificationHelp();
          } else {
            // Handle other iOS-specific errors
            const errorMessage = `iOS push registration error: ${subError.message}`;
            console.error(errorMessage);
            showNotification('Push Registration Failed', errorMessage, 'error');
          }
        } else if (window.PUSH_NOTIFICATION.IS_ANDROID) {
          // Android-specific error handling
          const errorMessage = `Android push registration error: ${subError.message}`;
          console.error(errorMessage);
          showNotification('Push Registration Failed', errorMessage, 'error');
          
          // Show Android help if permission denied
          if (Notification.permission === 'denied') {
            showAndroidNotificationHelp();
          }
        } else if (Notification.permission === 'denied') {
          console.log('Permission denied for notifications');
          showNotificationHelp();
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
          updated_at: new Date().toISOString(),
          platform: window.PUSH_NOTIFICATION.IS_IOS ? 'ios' : 
                   window.PUSH_NOTIFICATION.IS_ANDROID ? 'android' : 'other'
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
          updated_at: new Date().toISOString(),
          platform: window.PUSH_NOTIFICATION.IS_IOS ? 'ios' : 
                   window.PUSH_NOTIFICATION.IS_ANDROID ? 'android' : 'other'
        });
        
      if (insertError) {
        console.error('Error saving subscription:', insertError);
        return false;
      }
    }
    
    // Update user profile to reflect push notification preference
    await updateProfileNotificationSettings('push');
    
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

// Replace the existing testPushNotification function in push-notifications.js with this version
async function testPushNotification() {
  try {
    console.log('Sending test push notification...');
    
    // Log detailed device debug information
    const deviceInfo = logDeviceDebugInfo();
    
    // Choose which content type to test - alternating between update and urgent
    // Use local storage to track which one we last tested
    const lastTestedType = localStorage.getItem('lastPushTestType') || 'update';
    const testContentType = lastTestedType === 'update' ? 'urgent_prayer' : 'prayer_update';
    
    // Store the type we're testing now
    localStorage.setItem('lastPushTestType', testContentType);
    
    // Create a unique test ID
    const testId = Date.now().toString();
    
    // Get the correct view ID for this content type
    const viewId = testContentType === 'prayer_update' ? 'updates-view' : 'urgent-view';
    const viewName = viewId.replace('-view', '');
    
    // Show a toast to let the user know what's being tested
    if (typeof showToast === 'function') {
      showToast(
        'Test Notification', 
        `Sending test ${testContentType.replace('_', ' ')} notification... This will test navigation to the ${testContentType === 'prayer_update' ? 'Prayer Updates' : 'Urgent Prayers'} page.`, 
        'info', 
        4000
      );
    }
    
    // Prepare notification parameters with hash-based navigation
    const notificationParams = {
      userIds: [getUserId()],
      title: `Test ${testContentType === 'prayer_update' ? 'Prayer Update' : 'Urgent Prayer'}`,
      message: `This is a test ${testContentType.replace('_', ' ')} notification. Tap to open.`,
      contentType: testContentType,
      contentId: testId,
      viewId: viewId, // Explicitly include the view ID
      data: {
        // Use the new hash-based navigation format
        url: `/#${viewName}/content/${testId}`,
        timestamp: Date.now(),
        testMode: true,
        // Include these directly in the data object for redundancy
        viewId: viewId,
        contentId: testId,
        contentType: testContentType
      },
      // Visual properties to ensure proper display
      requireInteraction: true,
      renotify: true,
      vibrate: [100, 50, 100, 50, 100, 50, 100], 
      tag: `PECH-prayer-test-${testContentType}-${testId}`
    };
    
    // Add Android-specific parameters
    if (window.PUSH_NOTIFICATION.IS_ANDROID) {
      notificationParams.priority = 'high';
      notificationParams.actions = [
        {
          action: 'open',
          title: 'View'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ];
      // Android requires more descriptive messages
      notificationParams.message = `This is a test ${testContentType.replace('_', ' ')} notification. Tap to open the ${testContentType === 'prayer_update' ? 'Prayer Updates' : 'Urgent Prayers'} page.`;
    }
    
    // The Edge Function will handle additional platform-specific formatting
    const { data, error } = await supabase.functions.invoke('send-push-notifications', {
      body: notificationParams
    });
    
    if (error) {
      console.error('Error sending test notification:', error);
      
      // Show error message
      if (typeof showToast === 'function') {
        showToast('Error', `Failed to send notification: ${error.message}`, 'error', 5000);
      }
      
      return false;
    }
    
    console.log('Test notification result:', data);
    
    // Show a success message with clearer instructions
    if (typeof showToast === 'function') {
      const successMessage = window.PUSH_NOTIFICATION.IS_ANDROID ? 
        `Test notification sent successfully. If the app is already open, you should see it soon. If not, look for it in your notification tray and tap it to test opening the app and navigating to the ${viewName} view.` :
        `Test notification sent successfully. Wait for it to arrive and tap it to test navigation.`;
      
      showToast('Notification Sent', successMessage, 'success', 10000);
    }
    
    return true;
  } catch (error) {
    console.error('Error in testPushNotification:', error);
    
    // Show an error message
    if (typeof showToast === 'function') {
      showToast('Notification Error', `Failed to send test notification: ${error.message}`, 'error', 5000);
    }
    
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