// Push Notification Handler

// Set up the permission prompt only after the user has logged in
document.addEventListener('login-state-changed', function(event) {
    if (event.detail && event.detail.loggedIn) {
        // Check if on Android before setting up the prompt
        const isAndroid = /Android/.test(navigator.userAgent);
        if (isAndroid) {
            // Only proceed on Android devices
            setupPushPermissionPrompt();
        } else {
            console.log('Push notification prompt is only shown on Android devices');
        }
    }
});

// Setup the push notification permission prompt
function setupPushPermissionPrompt() {
    const prompt = document.getElementById('push-permission-prompt');
    const allowButton = document.getElementById('notification-allow');
    const laterButton = document.getElementById('notification-later');
    
    // Check if push notifications are supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications are not supported in this browser');
        return;
    }
    
    // Only show prompt on Android devices
    const isAndroid = /Android/.test(navigator.userAgent);
    if (!isAndroid) {
        console.log('Push notification prompt is only shown on Android devices');
        return;
    }
    
    // Check if the user's notification_method is set to "push"
    if (userProfile && userProfile.notification_method !== 'push') {
        console.log('User has not set notification_method to push, not showing prompt');
        return;
    }
    
    // Check if the user has already made a decision
    const pushDecision = localStorage.getItem('pushNotificationDecision');
    
    // If the user hasn't made a decision yet
    if (!pushDecision) {
        // Wait a bit before showing the prompt to avoid overwhelming the user
        setTimeout(() => {
            prompt.classList.add('show');
        }, 3000);
    }
    
    // Handle allow button click
    if (allowButton) {
        allowButton.addEventListener('click', async () => {
            prompt.classList.remove('show');
            localStorage.setItem('pushNotificationDecision', 'allowed');
            
            try {
                // Request permission and subscribe
                const result = await requestNotificationPermission();
                
                if (result.success) {
                    // Select the push notification radio button
                    const pushRadio = document.getElementById('notification-push');
                    if (pushRadio) {
                        pushRadio.checked = true;
                        
                        // Trigger change event to update related UI elements
                        const event = new Event('change');
                        pushRadio.dispatchEvent(event);
                    }
                    
                    showNotification('Notifications Enabled', 'You will now receive push notifications for prayer updates and urgent prayers.', 'success');
                } else {
                    showNotification('Notification Error', result.error, 'error');
                }
            } catch (error) {
                console.error('Error enabling push notifications:', error);
                showNotification('Error', 'Could not enable push notifications.', 'error');
            }
        });
    }
    
    // Handle later button click
    if (laterButton) {
        laterButton.addEventListener('click', () => {
            prompt.classList.remove('show');
            localStorage.setItem('pushNotificationDecision', 'later');
            
            // We'll ask again in 3 days
            localStorage.setItem('pushNotificationAskAgain', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString());
        });
    }
}

// Initialize the permission prompt handlers
document.addEventListener('DOMContentLoaded', function() {
    // Set up notification-related buttons
    const allowButton = document.getElementById('notification-allow');
    const laterButton = document.getElementById('notification-later');
    
    if (allowButton && laterButton) {
        // Ensure they have listeners even before the login event
        allowButton.addEventListener('click', function() {
            document.getElementById('push-permission-prompt').classList.remove('show');
        });
        
        laterButton.addEventListener('click', function() {
            document.getElementById('push-permission-prompt').classList.remove('show');
        });
    }
});
