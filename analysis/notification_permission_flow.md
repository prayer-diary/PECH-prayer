# Notification Permission Flow Analysis

## Overview

This analysis tracks all logic paths for requesting and setting up push notification permissions in the PECH Prayer app, starting from user login through to successful notification setup.

## High-Level Flow

1. **User Login** → **Profile Loading** → **Notification Setup** → **Permission Request** → **Service Worker Registration** → **Push Subscription**

## Detailed Logic Flow

### 1. Login and Profile Loading Flow

#### File: `auth.js`

**Login Entry Points:**
- `showLoggedInState()` - Lines 324-413
  - Called when user successfully logs in
  - Dispatches `login-state-changed` event with `{ loggedIn: true }`
  - Shows user's profile if `profile_set` is false

**Function Call Chain:**
```
showLoggedInState() → 
  document.dispatchEvent(new CustomEvent('login-state-changed', { detail: { loggedIn: true }})) →
  [Event triggers notification initialization]
```

### 2. Notification Initialization Flow

#### File: `push-notifications.js`

**Event Listener:**
```javascript
// Line 21-26
document.addEventListener('login-state-changed', function(event) {
  if (event.detail && event.detail.loggedIn) {
    // Call after a short delay to ensure profile is loaded
    setTimeout(initializePushNotifications, 2000);
  }
});
```

**Platform Detection Constants:**
```javascript
// Lines 8-13
window.PUSH_NOTIFICATION.IS_ANDROID = /Android/.test(navigator.userAgent);
window.PUSH_NOTIFICATION.IS_IOS = /AppleWebKit|iPad|iPhone|iPod/.test(navigator.userAgent);

// iOS refinement to exclude macOS
if (window.PUSH_NOTIFICATION.IS_IOS) {
  if (navigator.maxTouchPoints < 1) {
    window.PUSH_NOTIFICATION.IS_IOS = false;  // Probably macOS
  }
}
```

### 3. Platform-Specific Initialization

#### File: `push-notifications.js` - `initializePushNotifications()` function

**Flow for iOS Users:**
```javascript
// Check iOS version support (16.4+)
if (window.PUSH_NOTIFICATION.IS_IOS) {
  if (!isIOSVersionSupported()) {
    console.log('iOS version does not support Push API (requires iOS 16.4+)');
    return;
  }
  
  // Check if in standalone mode (app is installed)
  if (!isIOSStandalone()) {
    console.log('iOS device detected but not in standalone mode, skipping push initialization');
    showIOSInstallInstructions();  // Shows instructions to install PWA
    return;
  }
}
```

**Flow for Android Users:**
```javascript
// Android continues without special checks, but ensures service worker is registered
if (window.PUSH_NOTIFICATION.IS_ANDROID) {
  await ensureServiceWorkerRegistered();
}
```

### 4. User Profile Integration

#### File: `profile.js`

**When User Accesses Profile View:**

1. **Profile Loading** - `loadUserProfile()` function
   - Loads notification settings from database
   - Calls `loadProfileNotificationSettings(profile)`
   - Sets up event handlers via `setupNotificationMethodHandlers()`

2. **Notification Radio Button Logic:**
```javascript
// When user selects "Yes" for notifications
async function handleNotificationChange() {
  const notificationYes = document.getElementById('notification-yes');
  if (notificationYes && notificationYes.checked) {
    // Show testing panel
    notificationTestingPanel.classList.remove('d-none');
    
    // Platform-specific checks
    if (IS_IOS && !IS_STANDALONE) {
      // Show iOS installation requirement
      showIOSInstallInstructions();
      // Revert selection
      notificationYes.checked = false;
      notificationNo.checked = true;
      return;
    }
    
    // Request permission immediately
    const granted = await requestNotificationPermission();
    
    if (!granted) {
      // Revert selection if permission denied
      notificationYes.checked = false;
      notificationNo.checked = true;
    }
  }
}
```

### 5. Permission Request Flow

#### File: `push-notifications.js` - `requestNotificationPermission()` function

**Step-by-Step Flow:**

1. **Browser Support Check:**
```javascript
if (!('Notification' in window)) {
  showNotification('Not Supported', 'Notifications are not supported in this browser.', 'warning');
  return false;
}
```

2. **iOS Specific Checks:**
```javascript
if (window.PUSH_NOTIFICATION.IS_IOS) {
  // Check iOS version (16.4+)
  if (!isIOSVersionSupported()) {
    showNotification('Not Supported', 'Push notifications require iOS 16.4 or later.', 'warning');
    return false;
  }
  
  // Check standalone mode
  if (!isIOSStandalone()) {
    showIOSInstallInstructions();  // Shows how to install PWA
    return false;
  }
  
  // Check if previously denied
  if (Notification.permission === 'denied') {
    showIOSNotificationHelp();  // Shows how to reset permissions in iOS Settings
    return false;
  }
}
```

3. **Permission Request:**
```javascript
// Show custom permission prompt first (better UX)
const shouldProceed = await showCustomPermissionPrompt();

if (shouldProceed) {
  // Request browser permission
  const permission = await Notification.requestPermission();
  
  if (permission === 'granted') {
    // Subscribe to push notifications
    await subscribeToPushNotifications();
    return true;
  }
}
```

### 6. Service Worker Registration

#### File: `push-notifications.js` - `ensureServiceWorkerRegistered()` function

**Android-Specific Flow:**
```javascript
// Add cache-busting query parameter for Android
const cacheBustingPath = `${swPath}?v=${Date.now()}`;

// Register service worker
const registration = await navigator.serviceWorker.register(cacheBustingPath, {
  scope: swScope
});

// Handle installation/waiting states
if (registration.installing || registration.waiting) {
  if (registration.waiting) {
    // Force activation
    registration.waiting.postMessage({ action: 'skipWaiting' });
  }
  
  // Wait for activation
  await navigator.serviceWorker.ready;
}
```

### 7. Push Subscription Creation

#### File: `push-notifications.js` - `subscribeToPushNotifications()` function

**Platform-Specific Subscription Options:**

```javascript
// Prepare subscription options
const subscriptionOptions = {
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
};

// Add iOS-specific parameters
if (window.PUSH_NOTIFICATION.IS_IOS) {
  subscriptionOptions.prompt = true;  // Explicitly request prompt for iOS
}

// Create subscription
subscription = await registration.pushManager.subscribe(subscriptionOptions);
```

### 8. PWA Installation Handling

#### File: `app.js`

**Installation Flow:**

1. **Listen for Install Prompt:**
```javascript
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();  // Prevent Chrome's mini-infobar
  deferredPrompt = e;   // Store the event
  
  // Show custom install button after delay
  setTimeout(() => {
    if (!document.querySelector('.custom-install-button')) {
      showInstallButton();
    }
  }, 500);
});
```

2. **Install Button Action:**
```javascript
installButton.addEventListener('click', async () => {
  if (deferredPrompt) {
    // Show the browser's install prompt
    deferredPrompt.prompt();
    
    // Wait for user's choice
    const { outcome } = await deferredPrompt.userChoice;
    
    // Clean up
    deferredPrompt = null;
    installButton.remove();
    
    // Show login based on outcome
    if (!isLoggedIn()) {
      setTimeout(() => {
        window.restoreAuthFunctionality = true;
        initAuth();
        openAuthModal('login');
      }, 800);
    }
  }
});
```

3. **Post-Installation:**
```javascript
window.addEventListener('appinstalled', (evt) => {
  console.log('Prayer Diary was installed!');
  
  // Set installation flags
  localStorage.setItem('prayerDiaryInstalled', 'true');
  localStorage.setItem('prayerDiaryInstalledTime', Date.now().toString());
  
  // Show success message
  showInstallationSuccessMessage();
});
```

## Platform-Specific Differences

### iOS Flow

1. **Requires iOS 16.4+** for Push API support
2. **Must be installed as PWA** (standalone mode) before notifications work
3. **Installation must be done manually** via Safari's Share menu
4. **Special handling** for denied permissions (requires Safari settings reset)

### Android Flow

1. **No version restrictions** (modern Android supports push notifications)
2. **Can work in browser** without PWA installation (though PWA installation improves reliability)
3. **Automatic install prompt** shown via `beforeinstallprompt` event
4. **Service worker requires special handling** with cache-busting for reliable updates

## Error Handling

### iOS Errors
- Version not supported → Show "requires iOS 16.4+" message
- Not in standalone mode → Show PWA installation instructions
- Permission denied → Show steps to reset in iOS Settings

### Android Errors
- Permission denied → Show browser/device settings instructions
- Service worker issues → Force re-registration with cache-busting

## Key Helper Functions

1. **`isIOSVersionSupported()`** - Checks if iOS version is 16.4+
2. **`isIOSStandalone()`** - Detects if running as installed PWA on iOS
3. **`showIOSInstallInstructions()`** - Shows PWA installation steps for iOS
4. **`showIOSNotificationHelp()`** - Shows permission reset instructions for iOS
5. **`ensureServiceWorkerRegistered()`** - Ensures service worker is active (especially important for Android)
6. **`urlBase64ToUint8Array()`** - Converts VAPID key for push subscription

## Testing Functions

1. **`testPushNotification()`** - Sends a test notification via Edge Function
2. **`sendTestNotification()`** (in profile.js) - Alternative test via service worker
3. **Platform detection logging** in `logDeviceDebugInfo()`

This comprehensive flow ensures notifications work reliably across both iOS and Android, with proper error handling and user guidance for each platform's specific requirements.
