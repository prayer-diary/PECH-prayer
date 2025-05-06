// Updated push-notifications.js file
// Add this at the top of the file with other constants
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const IS_STANDALONE = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

// Replace the requestNotificationPermission function with this improved version
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

// Add this new function for iOS-specific notification help
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

// Add this new function for iOS installation instructions
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

// Update the initializePushNotifications function to add iOS checks
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
    
    // Rest of the function remains the same...
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

// Add a function to check and update profile notification settings
// This should be called when permission is denied to auto-switch to a different method
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

// Add this to handle settings change - put this in profile.js
// Add this to the notification method radio button change handler:
/*
document.querySelector('input[name="notification-method"]').addEventListener('change', function(e) {
  const newMethod = e.target.value;
  
  if (newMethod === 'push') {
    // Verify push notification support and permissions
    if (IS_IOS && !IS_STANDALONE) {
      // Show iOS installation requirement
      showIOSInstallInstructions();
      
      // Reset the selection to the previous value
      document.querySelector(`input[name="notification-method"][value="${userProfile.notification_method}"]`).checked = true;
      return;
    }
    
    // Request permission
    requestNotificationPermission().then(granted => {
      if (!granted) {
        // If permission not granted, revert to previous setting
        document.querySelector(`input[name="notification-method"][value="${userProfile.notification_method}"]`).checked = true;
      }
    });
  }
});
*/