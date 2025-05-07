// Main Application JavaScript

// Version information - using APP_VERSION from config.js
// (APP_VERSION is already declared in config.js)
const APP_VERSION_TIMESTAMP = Date.now();
console.log(`Prayer Diary initializing, version ${APP_VERSION}, build ${APP_VERSION_TIMESTAMP}`);

// Add debugging info to help track versions
window.PRAYER_DIARY = {
    version: APP_VERSION,
    buildTimestamp: APP_VERSION_TIMESTAMP,
    buildTime: new Date().toISOString(),
    devMode: window.PRAYER_DIARY_DEV_MODE || false
};

// Flag to track if update notification is already shown
let updateNotificationShown = false;

// Get the last acknowledged version from localStorage (if any)
const lastAcknowledgedVersion = localStorage.getItem('lastAcknowledgedVersion');

// Global variable for test date (used to show prayer cards for a different date)
window.testDate = null;

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);


// PWA Install detection and handling
let deferredPrompt;
let installInProgress = false;
const installContainer = document.createElement('div');

// Create a global tracking flag for installation availability
window.appIsInstallable = false;

// Patch the Bootstrap Modal to prevent login display when installable
if (typeof bootstrap !== 'undefined') {
    const originalModalShow = bootstrap.Modal.prototype.show;
    bootstrap.Modal.prototype.show = function() {
        // If this is the auth modal and app is installable, block it
        if (this._element && this._element.id === 'auth-modal' && window.appIsInstallable) {
            console.log('Bootstrap Modal show intercepted - auth modal blocked due to installation availability');
            return; // Block the modal from showing
        }
        
        // Otherwise, proceed as normal
        return originalModalShow.apply(this, arguments);
    };
}

// Listen for the beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('Installation prompt detected!');
    
    // Prevent the mini-info bar from appearing on mobile
    e.preventDefault();
    
    // Store the event so it can be triggered later
    deferredPrompt = e;
    
    // Set a flag to indicate we're handling installation
    sessionStorage.setItem('handlingInstallation', 'true');
    
    // Only show install button if it doesn't already exist
    setTimeout(() => {
        // Guard against duplicate buttons
        if (!document.querySelector('.custom-install-button')) {
            showInstallButton();
        }
    }, 500);
});
// Listen for the appinstalled event
window.addEventListener('appinstalled', (evt) => {
    // Log app installation
    console.log('Prayer Diary was installed!');
    
    // Show installation success message
    showInstallationSuccessMessage();
    
    // Clear the deferredPrompt variable
    deferredPrompt = null;
    
    // Set a flag in localStorage to indicate successful installation
    // This helps with authentication on next app start
    try {
        localStorage.setItem('prayerDiaryInstalled', 'true');
        localStorage.setItem('prayerDiaryInstalledTime', Date.now().toString());
    } catch (e) {
        console.warn("Couldn't set installation flag in localStorage:", e);
    }
});

// Function to show installation success message
function showInstallationSuccessMessage() {
    // Create and style the message container
    installContainer.className = 'install-success-message';
    installContainer.innerHTML = `
        <div class="install-message-content">
            <h3>Installation in progress</h3>
            <p>PECH prayer diary is being installed. You should shortly see a message confirming installation. An app launch icon will be added to your device</p>
            <p>Please wait for the message, then close this window and launch the app from your app icon for the best experience.</p>
            <button id="close-after-install" class="btn btn-primary">Close and Launch from Icon</button>
        </div>
    `;
    
    // Add to document
    document.body.appendChild(installContainer);
    
    // Add button functionality
    document.getElementById('close-after-install').addEventListener('click', () => {
        // Close the window/tab
        window.close();
        
        // Fallback message if window.close() doesn't work
        setTimeout(() => {
            installContainer.innerHTML = `
                <div class="install-message-content">
                    <h3>Please Close This Window</h3>
                    <p>Your browser prevented automatic closing.</p>
                    <p>Please manually close this window and open the Prayer Diary app from your home screen.</p>
                </div>
            `;
        }, 300);
    });
}

// Check if running in standalone mode (installed on home screen)
// Make this function globally available for other modules
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

// Optional: Function to show custom install button
function showInstallButton() {
    // Only show if not already in standalone mode
    if (isInStandaloneMode()) return;
    
    // Check if button already exists
    if (document.querySelector('.custom-install-button')) {
        console.log('Install button already exists, not adding another');
        return;
    }
    
    // Set installation in progress flag
    installInProgress = true;
    
    console.log('Adding installation button to navbar');
    
    const installButton = document.createElement('button');
    installButton.className = 'btn btn-sm btn-outline-light custom-install-button';
    installButton.innerHTML = '<i class="bi bi-download me-1"></i> Install App';
    installButton.addEventListener('click', async () => {
        if (deferredPrompt) {
            console.log('Install button clicked, showing prompt');
            
            // Show the install prompt
            deferredPrompt.prompt();
            
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User installation choice: ${outcome}`);
            
            // Clear the deferredPrompt variable
            deferredPrompt = null;
            
            // Clean up all flags
            installInProgress = false;
            sessionStorage.removeItem('handlingInstallation');
            
            // Remove the button
            installButton.remove();
            
            // Show login based on the outcome
            if (!isLoggedIn()) {
                console.log('User not logged in, showing login modal');
                // Slight delay to ensure cleanup is complete
                setTimeout(() => {
                    try {
                        // Re-initialize auth system to ensure login works properly
                        window.restoreAuthFunctionality = true;
                        initAuth();
                        
                        // Use the standard method which has all the proper event handlers
                        openAuthModal('login');
                    } catch (e) {
                        console.error('Error showing auth modal:', e);
                    }
                }, 800);
            }
        }
    });
    
    // Add to document in navbar next to the refresh button
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton && refreshButton.parentNode) {
        refreshButton.parentNode.appendChild(installButton);
    }
}

// Initialize app function
function initializeApp() {
    // Set initial flags
    window.appIsInstallable = false;
    
    // Check if the app is already installed and running in standalone mode
    if (isInStandaloneMode()) {
        window.restoreAuthFunctionality = true;
        console.log("App running in standalone mode, auth functionality enabled automatically");
    } else {
        window.restoreAuthFunctionality = false;
        console.log("App running in browser mode, auth functionality dependent on installation state");
    }
    
    // Register service worker first to ensure it's ready for other functionality
    registerServiceWorkerWithPushSupport()
      .then(() => {
        console.log('Service worker registration complete, continuing app initialization');
        // Check for updates after service worker is registered
        checkForAppUpdates();
      })
      .catch(error => {
        console.error('Service worker registration failed, continuing without push support:', error);
      });
    
    // Initialize splash screen first
    initSplashScreen();
    
    // Check if returning from profile save (should run early)
    checkForPostProfileSave();
    
    // Set up all modals
    setupAllModals();
    
    // Set up tab close detection for logout
    setupTabCloseLogout();
    
    // Force refresh of the drawer navigation after a short delay
    // This ensures any dynamically added menu items are included
    setTimeout(function() {
        document.dispatchEvent(new CustomEvent('navigation-updated'));
    }, 1500);
    
    // Set up delete user confirmation modal functionality
    const deleteUserModal = document.getElementById('delete-user-modal');
    if (deleteUserModal) {
        deleteUserModal.addEventListener('shown.bs.modal', function() {
            // Focus the confirm delete button when modal is shown
            const confirmButton = document.getElementById('confirm-delete-user');
            if (confirmButton) {
                confirmButton.focus();
            }
        });
    }
    
    // Handle login and installation flow sequencing
    console.log('Checking for installation state...');
    
    // Make sure we don't have leftover flags from previous sessions
    if(sessionStorage.getItem('installButtonShown')) {
        sessionStorage.removeItem('installButtonShown');
    }
    
    // Nothing else to do here - the beforeinstallprompt event and patched bootstrap modal
    // will handle the rest of the installation and login process
    
    // Initialize topics functionality
    document.addEventListener('login-state-changed', function(event) {
        if (event.detail && event.detail.loggedIn) {
            // Initialize topics when user is logged in
            initTopics();
        }
    });
}

// Listen for navigation messages from the service worker
navigator.serviceWorker.addEventListener('message', function(event) {
  // Check if the message is a navigation request
  if (event.data && event.data.type === 'NAVIGATE_TO_VIEW') {
    console.log('Received navigation request from service worker:', event.data);
    
    const viewId = event.data.viewId;
    const notificationData = event.data.data || {};
    
    // Only proceed if view ID is valid
    if (viewId && document.getElementById(viewId)) {
      console.log(`Navigating to ${viewId} from notification click`);
      
      // Ensure the app is fully initialized before navigating
      const performNavigation = function() {
        // If the app views aren't visible yet, make them visible
        const appViews = document.getElementById('app-views');
        const landingView = document.getElementById('landing-view');
        
        if (appViews && appViews.classList.contains('d-none')) {
          appViews.classList.remove('d-none');
        }
        
        if (landingView && !landingView.classList.contains('d-none')) {
          landingView.classList.add('d-none');
        }
        
        // Show the target view
        showView(viewId);
        
        // Call the appropriate loader function based on the view ID
        if (viewId === 'calendar-view' && typeof loadPrayerCalendar === 'function') {
          loadPrayerCalendar();
        }
        else if (viewId === 'updates-view' && typeof loadPrayerUpdates === 'function') {
          loadPrayerUpdates();
          
          // If we have an update ID, try to open that specific update
          if (notificationData.contentId && typeof viewUpdate === 'function') {
            setTimeout(() => {
              viewUpdate(notificationData.contentId);
            }, 500);
          }
        }
        else if (viewId === 'urgent-view' && typeof loadUrgentPrayers === 'function') {
          loadUrgentPrayers();
          
          // If we have an urgent prayer ID, try to open that specific urgent prayer
          if (notificationData.contentId && typeof viewUrgentPrayer === 'function') {
            setTimeout(() => {
              viewUrgentPrayer(notificationData.contentId);
            }, 500);
          }
        }
        
        // Show a toast notification to confirm navigation
        if (typeof showToast === 'function') {
          showToast('Notification', 'Navigated to ' + viewId.replace('-view', '') + ' view', 'info', 3000);
        }
      };
      
      // Check if the app is ready for navigation
      if (isAppReady()) {
        // App is ready, perform navigation immediately
        performNavigation();
      } else {
        // App isn't ready yet, set up a timer to check readiness
        console.log('App not ready for navigation, will retry...');
        
        // Store the navigation request for later
        window.pendingNotificationNavigation = {
          viewId: viewId,
          data: notificationData
        };
        
        // Set up a retry mechanism
        let retryCount = 0;
        const maxRetries = 10;
        const retryInterval = 500; // 500ms between retries
        
        const navigationRetryTimer = setInterval(() => {
          retryCount++;
          console.log(`Navigation retry attempt ${retryCount}/${maxRetries}`);
          
          if (isAppReady()) {
            // App is ready, perform navigation
            clearInterval(navigationRetryTimer);
            performNavigation();
            window.pendingNotificationNavigation = null;
          }
          else if (retryCount >= maxRetries) {
            // Give up after max retries
            clearInterval(navigationRetryTimer);
            console.error('Failed to navigate after multiple attempts - app not ready');
            
            // Show an error toast if available
            if (typeof showToast === 'function') {
              showToast('Navigation Error', 'Could not navigate to the requested view', 'error', 5000);
            }
            
            // Force a view change to default view as fallback
            console.log('Forcing default view as fallback');
            try {
              showView('calendar-view');
              if (typeof loadPrayerCalendar === 'function') {
                loadPrayerCalendar();
              }
            } catch (e) {
              console.error('Error showing fallback view:', e);
            }
          }
        }, retryInterval);
      }
    } else {
      console.warn('Invalid view ID received from service worker:', viewId);
    }
  }
  
  // Handle update check response
  if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
    console.log('Update available notification received from Service Worker');
    const newVersion = event.data.currentVersion;
    
    // Only show notification if not already shown AND 
    // if this version hasn't been acknowledged before
    if (!updateNotificationShown && newVersion !== lastAcknowledgedVersion) {
      showUpdateNotification(newVersion);
      updateNotificationShown = true;
    }
  }
});

// Check if the app is ready for navigation
function isAppReady() {
  // Check various conditions that indicate app readiness
  const appViews = document.getElementById('app-views');
  const isLoggedInFunc = window.isLoggedIn || function() { return false; };
  
  // App is ready if:
  // 1. App views container exists
  // 2. User is logged in (if we have the function)
  // 3. Key UI components are initialized
  const ready = 
    appViews !== null && 
    isLoggedInFunc() && 
    typeof showView === 'function';
    
  console.log('App ready check:', ready);
  return ready;
}

// Notify service worker that the client is ready
function notifyServiceWorkerReady() {
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    // Send ready message
    navigator.serviceWorker.controller.postMessage({
      type: 'CLIENT_READY',
      pendingNavigation: window.pendingNotificationNavigation
    });
    console.log('Notified service worker that client is ready');
  }
}

// Add this to your page initialization code
document.addEventListener('login-state-changed', function(event) {
  if (event.detail && event.detail.loggedIn) {
    // Wait a moment for UI to initialize after login, then notify service worker
    setTimeout(notifyServiceWorkerReady, 1000);
  }
});

// Ensure we notify service worker on page load if already logged in
document.addEventListener('DOMContentLoaded', function() {
  // Use a timer to give the app time to initialize
  setTimeout(() => {
    if (window.isLoggedIn && window.isLoggedIn()) {
      notifyServiceWorkerReady();
    }
  }, 1500);
});

// Splash Screen functionality
function initSplashScreen() {
    // Set the version number from APP_VERSION
    document.getElementById('splash-version-number').textContent = APP_VERSION;
    
    // Add splash-active class to main content containers
    document.getElementById('landing-view').classList.add('splash-active');
    document.getElementById('app-views').classList.add('splash-active');
    
    // Show splash screen
    const splashScreen = document.getElementById('splash-screen');
    
    // Set a timer to hide the splash screen after 3 seconds
    setTimeout(() => {
        // Start the fade out animation
        splashScreen.classList.add('fade-out');
        
        // After animation completes, remove the splash screen and show app
        setTimeout(() => {
            // Remove splash screen from DOM
            splashScreen.remove();
            
            // Remove splash-active class from main containers
            document.getElementById('landing-view').classList.remove('splash-active');
            document.getElementById('app-views').classList.remove('splash-active');
            
            // Show initial view as normal (depends on logged in state)
            if (isLoggedIn()) {
                // Show the app views
                document.getElementById('landing-view').classList.add('d-none');
                document.getElementById('app-views').classList.remove('d-none');
                // Show calendar view
                showView('calendar-view');
                // Load prayer calendar
                loadPrayerCalendar();
            } else {
                // If we're handling installation, don't show login yet
                if (!sessionStorage.getItem('handlingInstallation')) {
                    // Only show login if we're not handling installation
                    console.log('Not handling installation, safe to show login');
                    setTimeout(() => {
                        // Restore auth functionality
                        window.restoreAuthFunctionality = true;
                        initAuth();
                        
                        // Use standard login function which has proper event handlers
                        openAuthModal('login');
                    }, 500);
                } else {
                    console.log('Handling installation, not showing login yet');
                }
            }
        }, 500); // Wait for the fade animation to complete
    }, 3000); // 3 seconds display time
}

// Add this to app.js or at the beginning of your main execution flow
function checkForPostProfileSave() {
    // Check if coming back from a profile save refresh
    if (sessionStorage.getItem('profileSaved') === 'true') {
        // Clear the flag
        sessionStorage.removeItem('profileSaved');
        
        // Show a message
        setTimeout(() => {
            showNotification('Profile Updated', 'Your profile has been successfully updated.', 'success');
        }, 500);
        
        // If user was in the profile view before refresh, return there
        if (sessionStorage.getItem('lastView') === 'profile-view') {
            setTimeout(() => {
                showView('profile-view');
            }, 100);
        }
    }
}

// Make sure to call this function when the app initializes
// Add this line to your app initialization code (app.js or similar)
// document.addEventListener('DOMContentLoaded', checkForPostProfileSave);


// Setup logout on tab close functionality
function setupTabCloseLogout() {
    // Use the beforeunload event to detect when the user is leaving
    window.addEventListener('beforeunload', function(e) {
        if (isLoggedIn && isLoggedIn()) {
            console.log("Tab closing - performing quick logout");
            
            // We can't wait for async operations to complete on tab close,
            // so we'll just clear the auth tokens from storage directly
            try {
                localStorage.removeItem('supabase.auth.token');
                localStorage.removeItem('supabase.auth.expires_at');
                sessionStorage.removeItem('supabase.auth.token');
                
                // Clear any app-specific storage
                sessionStorage.removeItem('prayerDiaryLastView');
                sessionStorage.removeItem('prayerDiaryLastUpdate');
                
                // Set a flag indicating the user didn't log out properly
                // This could be used to show a message on next login if needed
                sessionStorage.setItem('prayerDiaryTabClosed', 'true');
            } catch (error) {
                console.error("Error clearing auth storage on tab close:", error);
            }
        }
    });
}

// Function to set up all modals properly
function setupAllModals() {
    console.log('Setting up all modals');
    
    // Add global handlers for all modals
    document.addEventListener('hidden.bs.modal', function(event) {
        console.log('Modal hidden event triggered');
        
        // Clean up any leftover backdrops
        setTimeout(cleanupModalBackdrops, 100);
    });
    
    // Set up a global emergency escape key handler
    document.addEventListener('keydown', function(event) {
        // If Escape key pressed
        if (event.key === 'Escape') {
            console.log('Escape key pressed - checking for stuck modals');
            
            // Check if body still has modal-open class but no visible modals
            const visibleModals = document.querySelectorAll('.modal.show');
            if (document.body.classList.contains('modal-open') && visibleModals.length === 0) {
                console.log('Detected stuck modal state - cleaning up');
                cleanupModalBackdrops();
            }
        }
    });
    
    // Set up notification modal specifically
    setupNotificationCloseButton();
    
    // Recovery button removed
    // Check if Supabase configuration is set
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        showNotification(
            'Configuration Required',
            `
            <p>You need to configure the Supabase settings before using the app.</p>
            <p>Please update the <code>js/config.js</code> file with your Supabase URL and anonymous key.</p>
            <p>See the setup documentation for more details.</p>
            `
        );
    }
    
    // Initialize UI components
    initUI();
    
    // Check if we have a super admin user and create one if it doesn't exist
    //checkForSuperAdmin(); removed due to RLS problems. We will always create a super admin via SQL if needed
    
    // Request notification permissions if supported
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        // Wait a bit before requesting permissions to avoid overwhelming the user on first visit
        setTimeout(() => {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('Notification permission granted.');
                }
            });
        }, 5000);
    }
}

// Check if super admin exists and create one if needed
async function checkForSuperAdmin() {
    try {
        // Check if super admin account exists
        const { data: adminUser, error: adminError } = await supabase
            .from('profiles')
            .select('id, user_role')
            .eq('user_role', 'Administrator')
            .limit(1);
            
        if (adminError) throw adminError;
        
        // If no admin exists, create one
        if (!adminUser || adminUser.length === 0) {
            console.log('No admin user found. Trying to create super admin...');
            try {
                // Note: This function is defined in auth.js
                await createSuperAdmin();
            } catch (error) {
                console.error('Error creating super admin:', error);
            }
        }
    } catch (error) {
        console.error('Error checking for super admin:', error);
    }
}

// Register service worker with explicit push support
function registerServiceWorkerWithPushSupport() {
  return new Promise((resolve, reject) => {
    if (!('serviceWorker' in navigator)) {
    console.warn('Service workers are not supported in this browser');
    return reject(new Error('Service workers not supported'));
    }
    
    // Listen for activation message from the service worker
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data && event.data.type === 'SW_ACTIVATED') {
        console.log('[Client] Received service worker activation message for version:', event.data.version);
        
        // If we have a pending resolve function, call it
        if (window.pendingServiceWorkerResolve) {
        window.pendingServiceWorkerResolve(navigator.serviceWorker.controller);
          window.pendingServiceWorkerResolve = null;
        }
      }
    });

    // Register the service worker with the correct path
    const swPath = window.location.pathname.includes('/PECH-prayer') ? '/PECH-prayer/service-worker.js' : '/service-worker.js';
    const swScope = window.location.pathname.includes('/PECH-prayer') ? '/PECH-prayer/' : '/';

    console.log('[Client] Registering service worker at:', swPath, 'with scope:', swScope);

    navigator.serviceWorker.register(swPath, {
    scope: swScope
    })
    .then(registration => {
    console.log('[Client] Service Worker registered with scope:', registration.scope);

    // Store the registration globally for future use with push notifications
    window.swRegistration = registration;

    // Check the current state of the service worker
    if (registration.active) {
    console.log('[Client] Service worker is already active');
    resolve(registration);
    return;
    }

    if (registration.installing) {
    console.log('[Client] Service worker is installing');
      registration.installing.addEventListener('statechange', event => {
      console.log('[Client] Service worker state changed to:', event.target.state);
      if (event.target.state === 'activated') {
          console.log('[Client] Service worker activated via statechange event');
        resolve(registration);
      }
      });
    } else if (registration.waiting) {
      console.log('[Client] Service worker is waiting, forcing activation');
      // Create a promise that will be resolved when we receive the activation message
    const activationPromise = new Promise(activationResolve => {
    window.pendingServiceWorkerResolve = activationResolve;
    });

    // Send skipWaiting message
    registration.waiting.postMessage({action: 'skipWaiting'});
      
        // Listen for controller change indicating activation
        navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[Client] Service worker controller changed');
      });
        
          // Wait for activation or timeout
            Promise.race([
              activationPromise,
              new Promise(timeoutResolve => setTimeout(timeoutResolve, 5000))
            ]).then(() => {
              resolve(registration);
            });
          } else {
            console.warn('[Client] No installing or waiting service worker found');
            // Just resolve with what we have
            resolve(registration);
          }
          
          // Set a fallback timeout
          setTimeout(() => {
            console.warn('[Client] Service worker activation timeout - resolving anyway');
            resolve(registration);
          }, 6000);
        })
        .catch(error => {
          console.error('[Client] Service Worker registration failed:', error);
          reject(error);
        });
      });
}

// Check for app updates
function checkForAppUpdates() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    // Wait for service worker to be ready before checking for updates
    setTimeout(() => {
      if (window.swRegistration) {
        checkForAppUpdate(window.swRegistration);
        
        // Check for updates periodically (every 30 minutes)
        setInterval(() => {
          checkForAppUpdate(window.swRegistration);
        }, 30 * 60 * 1000);
      }
    }, 5000);
  }
}

// Check for app updates by comparing versions
function checkForAppUpdate(registration) {
    console.log('Checking for app updates...');
    
    // Send message to service worker to check for updates
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            action: 'CHECK_FOR_UPDATES',
            version: APP_VERSION
        });
    }
}

// Show update notification to user
function showUpdateNotification(newVersion) {
    // Store the version for later use
    const currentNewVersion = newVersion;
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container.position-fixed.top-0.end-0.p-3');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed top-0.end-0.p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create the update notification toast
    const updateNotification = document.createElement('div');
    updateNotification.className = 'toast toast-update';
    updateNotification.setAttribute('role', 'alert');
    updateNotification.setAttribute('aria-live', 'assertive');
    updateNotification.setAttribute('aria-atomic', 'true');
    updateNotification.innerHTML = `
        <div class="toast-header bg-primary text-white">
            <strong class="me-auto">Update Available</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            <p>A new version of Prayer Diary (v${currentNewVersion}) is available!</p>
            <div class="mt-2 pt-2 border-top d-flex justify-content-end">
                <button type="button" class="btn btn-primary btn-sm" id="update-app-btn">Update Now</button>
            </div>
        </div>
    `;
    
    // Add to the container
    toastContainer.appendChild(updateNotification);
    
    // Initialize the toast
    const toast = new bootstrap.Toast(updateNotification, { autohide: false });
    toast.show();
    
    // Add event listener for the update button
    document.getElementById('update-app-btn').addEventListener('click', function() {
        // Show a loading message
        this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...';
        this.disabled = true;
        
        // Store the current version as acknowledged to prevent update loop
        localStorage.setItem('lastAcknowledgedVersion', currentNewVersion);
        
        // Force update by unregistering the service worker and reloading
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                // Unregister all service workers
                return Promise.all(registrations.map(registration => registration.unregister()));
            }).then(() => {
                // Clear caches
                return caches.keys().then(cacheNames => {
                    return Promise.all(
                        cacheNames.map(cacheName => {
                            return caches.delete(cacheName);
                        })
                    );
                });
            }).then(() => {
                // Reload the page
                window.location.reload(true);
            }).catch(error => {
                console.error('Error during update:', error);
                alert('Update failed. Please try refreshing the page.');
            });
        } else {
            // Fallback for browsers without service worker support
            window.location.reload(true);
        }
    });
}