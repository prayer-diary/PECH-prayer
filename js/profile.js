// User Profile Module

// Flag to prevent multiple simultaneous profile loads
let profileLoadInProgress = false;

// Device detection constants
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const IS_STANDALONE = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

// Load and display the user's profile
async function loadUserProfile() {
    if (!isLoggedIn()) return;
	
    // Prevent multiple simultaneous calls
    if (profileLoadInProgress) {
        console.log('Profile load already in progress, skipping duplicate call');
        return;
    }
	
	await window.waitForAuthStability();
    
    profileLoadInProgress = true;
    
    // Initialize visibility handlers for calendar hide option
    setupCalendarHideHandlers();
    
    try {
        // Refresh user profile from database
        await fetchUserProfile();
        
        if (!userProfile) {
            showNotification('Error', 'Unable to load your profile. Please try again later.');
            return;
        }
        
        // Ensure we have the latest user metadata
        const { data, error } = await supabase.auth.getUser();
        if (!error && data.user) {
            // Update the currentUser variable with the latest data
            currentUser = data.user;
        }
        
        // Update profile images if available
        if (userProfile.profile_image_url) {
            updateAllProfileImages(userProfile.profile_image_url);
        }
        
        // Get the name from the most reliable source
        const userName = userProfile.full_name || 
                        (currentUser.user_metadata ? currentUser.user_metadata.full_name : null) || 
                        currentUser.email || 
                        "Unknown User";
        
        // Explicitly set the value
        const nameField = document.getElementById('profile-name');
        nameField.value = userName;
        
        // Force the field to update (sometimes needed for read-only fields)
        nameField.defaultValue = userName;
        
        // Set photo tag field - use existing value or default to full name
        const photoTagField = document.getElementById('profile-photo-tag');
        if (photoTagField) {
            photoTagField.value = userProfile.photo_tag || userName;
        }
        
        // Set calendar hide checkbox
        const calendarHideCheckbox = document.getElementById('profile-calendar-hide');
        if (calendarHideCheckbox) {
            calendarHideCheckbox.checked = userProfile.calendar_hide || false;
            // Update visibility of prayer points and preview based on checkbox
            updateCalendarHideVisibility();
        }
        
        document.getElementById('profile-prayer-points').value = userProfile.prayer_points || '';
        // Format phone number for display (convert from +44 to 0)
        let displayPhoneNumber = '';
        if (userProfile.phone_number && userProfile.phone_number.startsWith('+44')) {
            displayPhoneNumber = '0' + userProfile.phone_number.substring(3);
        } else {
            displayPhoneNumber = userProfile.phone_number || '';
        }
        document.getElementById('profile-mobile').value = displayPhoneNumber;
        
        // Set content delivery radio button based on the new content_delivery_email field
        const contentDeliveryEmail = userProfile.content_delivery_email !== false; // Default to true if undefined
        document.querySelector(`input[name="content-delivery"][value="${contentDeliveryEmail ? 'app-email' : 'app-only'}"]`).checked = true;
        
        // Set notification method radio button based on the new simplified notification_method field
        await loadProfileNotificationSettings(userProfile);
        
        // Set up notification method change handlers
        setupNotificationMethodHandlers();
        
        // Initial check for which phone fields to show
        updatePhoneFieldsVisibility();
        
        // Reset GDPR consent checkbox and button
        if (document.getElementById('gdpr-consent-check')) {
            document.getElementById('gdpr-consent-check').checked = false;
            document.getElementById('gdpr-consent-submit').disabled = true;
        }
        
        // Ensure name is visible in the form before updating preview
        setTimeout(() => {
            // Double-check name field is populated
            const nameField = document.getElementById('profile-name');
            if (!nameField.value || nameField.value.trim() === '') {
                // One last attempt to set it
                nameField.value = userProfile.full_name || 
                                 (currentUser.user_metadata ? currentUser.user_metadata.full_name : null) || 
                                 currentUser.email || 
                                 "Unknown User";
            }
            
            // Now update the preview
            updateProfilePreview();
        }, 100);
        
        // Update approval status message
        const profileStatus = document.getElementById('profile-status');
        if (userProfile.approval_state === 'Pending') {
            profileStatus.classList.remove('d-none');
            profileStatus.classList.remove('alert-danger');
            profileStatus.classList.add('alert-warning');
            profileStatus.innerHTML = `
                <p class="mb-0">Your account is pending approval by an administrator. You'll receive an email when your account is approved.</p>
            `;
        } else if (userProfile.approval_state === 'Rejected') {
            profileStatus.classList.remove('d-none');
            profileStatus.classList.remove('alert-warning');
            profileStatus.classList.add('alert-danger');
            profileStatus.innerHTML = `
                <p class="mb-0">Your account has been rejected by an administrator. Please contact the church office for more information.</p>
            `;
        } else {
            profileStatus.classList.add('d-none');
        }
        
        // Set up form submission
        document.getElementById('profile-form').addEventListener('submit', saveProfile);
        
        // Set up preview update when fields change
        document.getElementById('profile-name').addEventListener('input', updateProfilePreview);
        document.getElementById('profile-prayer-points').addEventListener('input', updateProfilePreview);
        
        // Set up profile image handler (we now use the same handler for all devices)
        setupProfileImageHandlers();
        
        // Add change handler for photo tag to update preview
        document.getElementById('profile-photo-tag').addEventListener('input', updateProfilePreview);
        
        // Set up test notification button
        setupTestNotificationButton();
        
    } catch (error) {
        console.error('Error loading profile:', error);
        showNotification('Error', `Unable to load your profile: ${error.message}`);
    } finally {
        // Reset the flag to allow future profile loads
        profileLoadInProgress = false;
    }
}

// Update the profile loading function to handle the new notification structure
async function loadProfileNotificationSettings(profile) {
    // Set the notification radio buttons based on the saved preference
    let notificationYes = false;
    
    // If user has push notifications set, check if browser permission is actually granted
    if (profile.notification_method === 'push') {
        // Check both the database setting AND the browser permission
        const hasPermission = Notification.permission === 'granted';
        const hasSubscription = await (window.checkPushSubscriptionStatus ? window.checkPushSubscriptionStatus() : false);
        
        // Only enable "Yes" if we have both permission and a subscription
        if (hasPermission && hasSubscription) {
            notificationYes = true;
        } else {
            // User has it enabled in database but not in browser - reset to "No"
            console.log('User has push enabled in database but no browser permission/subscription');
            notificationYes = false;
        }
    }
    
    document.getElementById('notification-yes').checked = notificationYes;
    document.getElementById('notification-no').checked = !notificationYes;
    
    // Trigger the change event to show/hide appropriate panels
    await handleNotificationChange();
}

// Update the profile saving function to handle the new notification structure
function saveProfileNotificationSettings() {
    const notificationYes = document.getElementById('notification-yes').checked;
    
    // Check if the user actually has permission when they say "Yes"
    const hasPermission = Notification.permission === 'granted';
    
    // Only set to 'push' if they checked Yes AND have browser permission
    let notificationMethod = 'none';
    if (notificationYes && hasPermission) {
        notificationMethod = 'push';
    }
    
    return {
        notification_method: notificationMethod,
        // Keep other notification fields for future use
        notification_push: notificationYes && hasPermission
    };
}

// Event listeners for notification radio buttons
async function handleNotificationChange() {
    const notificationYes = document.getElementById('notification-yes');
    const notificationNo = document.getElementById('notification-no');
    const testingPanel = document.getElementById('notification-testing-panel');
    
    if (notificationYes && notificationYes.checked) {
        // User selected "Yes" for notifications
        
        // Show the testing panel
        if (testingPanel) {
            testingPanel.classList.remove('d-none');
        }
        
        // Check if we need to request permission
        if (Notification.permission !== 'granted') {
            console.log('User wants notifications but permission not yet granted');
            
            // Show temporary message while permission is being handled
            showNotification('Enabling Notifications', 'Please allow notifications when prompted to complete the setup.');
            
            // Request permission using the unified flow
            await window.requestPushNotificationPermission(
                // Success callback
                () => {
                    console.log('Push notifications enabled successfully');
                    showNotification('Success', 'Push notifications are now enabled! You can test them using the button below.', 'success');
                },
                // Denied callback
                (message) => {
                    console.log('Push notification permission denied');
                    showNotification('Permission Denied', message, 'warning');
                    
                    // Reset the user's selection since permission wasn't granted
                    document.getElementById('notification-no').checked = true;
                    document.getElementById('notification-yes').checked = false;
                    
                    // Hide the testing panel
                    if (testingPanel) {
                        testingPanel.classList.add('d-none');
                    }
                },
                // Requirements not met callback
                (message) => {
                    console.log('Push notification requirements not met');
                    showNotification('Not Available', message, 'info');
                    
                    // Reset the user's selection since requirements aren't met
                    document.getElementById('notification-no').checked = true;
                    document.getElementById('notification-yes').checked = false;
                    
                    // Hide the testing panel
                    if (testingPanel) {
                        testingPanel.classList.add('d-none');
                    }
                }
            );
        } else {
            // Permission already granted
            console.log('Push notifications already enabled');
            
            // Ensure we have an active subscription
            const hasSubscription = await window.checkPushSubscriptionStatus();
            if (!hasSubscription) {
                // Create subscription if it doesn't exist
                await subscribeToPushNotifications();
            }
        }
        
    } else {
        // User selected "No" for notifications
        if (testingPanel) {
            testingPanel.classList.add('d-none');
        }
        
        // Optionally unsubscribe if they had notifications enabled
        if (window.unsubscribeFromPushNotifications) {
            await window.unsubscribeFromPushNotifications();
        }
    }
    
    // Hide phone number section (SMS/WhatsApp are dormant)
    document.getElementById('phone-number-section').classList.add('d-none');
}

function setupProfileImageHandlers() {
    const selectButton = document.getElementById('select-profile-image');
    const fileInput = document.getElementById('profile-image');
    
    // First add event listener to the file input
    if (fileInput) {
        fileInput.addEventListener('change', handleProfileImageChange);
    }
    
    if (selectButton && fileInput) {
        // Remove any existing event listeners first to prevent duplicates
        const newSelectButton = selectButton.cloneNode(true);
        selectButton.parentNode.replaceChild(newSelectButton, selectButton);
        
        // Update button text from "Change Picture" to "Choose File"
        newSelectButton.innerHTML = '<i class="bi bi-file-earmark-image me-1"></i> Choose File';
        
        // Make the button smaller
        newSelectButton.classList.add('btn-sm');
        
        // Check device type
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isAndroid = /Android/.test(navigator.userAgent);
        
        if (isAndroid) {
            // For Android, go straight to gallery
            newSelectButton.addEventListener('click', function() {
                // For Android, bypass the modal and go straight to gallery
                triggerGallerySelection();
            });
        } else if (isIOS) {
            // For iOS, we need to handle differently to avoid showing camera option
            newSelectButton.addEventListener('click', function() {
                handleIOSFileSelection();
            });
        } else {
            // For other devices, use standard behavior
            newSelectButton.addEventListener('click', function() {
                fileInput.click();
            });
        }
    }
    
    // Initialize the square camera module
    if (typeof initSquareCamera === 'function') {
        initSquareCamera();
        
        // Fix the layout of profile image buttons
        fixProfileButtonsLayout();
    }
}

// Function to fix the profile buttons layout
function fixProfileButtonsLayout() {
    // Get the container of the buttons (parent of the select button)
    const selectButton = document.getElementById('select-profile-image');
    if (!selectButton) return;
    
    const buttonContainer = selectButton.parentNode;
    
    // Add a class to make it a proper container with styling
    buttonContainer.classList.add('profile-image-buttons-container');
    
    // Make sure the buttons have the right classes for size
    const takePhotoBtn = document.getElementById('take-profile-photo');
    if (takePhotoBtn) {
        // Ensure consistent styling between buttons
        takePhotoBtn.classList.remove('ms-2'); // Remove margin spacing
        takePhotoBtn.classList.add('btn-sm'); // Add small button class
    }
    
    if (selectButton) {
        selectButton.classList.add('btn-sm'); // Make it small too
    }
}

// Handle iOS file selection to prevent camera option
function handleIOSFileSelection() {
    const fileInput = document.getElementById('profile-image');
    
    // Clone the file input to remove any existing attributes
    const newFileInput = fileInput.cloneNode(false);
    
    // Explicitly set accept to only image files
    // iOS will not show camera option if we use these more specific MIME types
    newFileInput.setAttribute('accept', 'image/jpeg,image/png,image/gif');
    
    // Re-add the change event listener
    newFileInput.addEventListener('change', handleProfileImageChange);
    
    // Replace the original file input
    fileInput.parentNode.replaceChild(newFileInput, fileInput);
    
    // Click the file input to open the gallery
    newFileInput.click();
}

// Function to show photo options modal for Android
function showPhotoOptions() {
    // Create modal HTML if it doesn't exist yet
    if (!document.getElementById('photo-options-modal')) {
        const modalHtml = `
        <div class="modal fade" id="photo-options-modal" tabindex="-1" aria-labelledby="photo-options-title" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="photo-options-title">Select Image Source</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="d-grid gap-3">
                            <button type="button" class="btn btn-primary" id="take-photo-btn">
                                <i class="bi bi-camera-fill me-2"></i>Take Photo
                            </button>
                            <button type="button" class="btn btn-secondary" id="choose-gallery-btn">
                                <i class="bi bi-images me-2"></i>Choose from Gallery
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
        
        // Append modal to the body
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer.firstElementChild);
        
        // Set up event listeners for the modal buttons
        document.getElementById('take-photo-btn').addEventListener('click', function() {
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('photo-options-modal'));
            modal.hide();
            
            // Set capture attribute and trigger camera
            triggerCameraCapture();
        });
        
        document.getElementById('choose-gallery-btn').addEventListener('click', function() {
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('photo-options-modal'));
            modal.hide();
            
            // Trigger standard file selection
            triggerGallerySelection();
        });
    }
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('photo-options-modal'));
    modal.show();
}

// Function to trigger camera capture
function triggerCameraCapture() {
    const fileInput = document.getElementById('profile-image');
    
    // First, clone the file input to remove any existing event listeners
    const newFileInput = fileInput.cloneNode(false);
    
    // Set capture attribute to camera (this makes it use the camera on Android)
    newFileInput.setAttribute('capture', 'camera');
    newFileInput.setAttribute('accept', 'image/*');
    
    // Re-add the change event listener
    newFileInput.addEventListener('change', handleProfileImageChange);
    
    // Replace the original file input
    fileInput.parentNode.replaceChild(newFileInput, fileInput);
    
    // Click the file input to open the camera
    newFileInput.click();
}

// Function to trigger gallery selection
function triggerGallerySelection() {
    const fileInput = document.getElementById('profile-image');
    
    // First, clone the file input to remove any existing attributes from camera mode
    const newFileInput = fileInput.cloneNode(false);
    
    // Remove any capture attribute that might be present
    newFileInput.removeAttribute('capture');
    
    // Set accept to all images
    newFileInput.setAttribute('accept', 'image/*');
    
    // Re-add the change event listener
    newFileInput.addEventListener('change', handleProfileImageChange);
    
    // Replace the original file input
    fileInput.parentNode.replaceChild(newFileInput, fileInput);
    
    // Click the file input to open the gallery
    newFileInput.click();
}

// Handle profile image selection
function handleProfileImageChange() {
    const fileInput = document.getElementById('profile-image');
    const previewImage = document.getElementById('profile-image-preview');
    
    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        
        // Debug image characteristics
        console.log('Selected image details:', {
            name: file.name,
            type: file.type,
            size: Math.round(file.size/1024) + ' KB',
            lastModified: new Date(file.lastModified).toISOString()
        });
        
        // Create canvas for square cropping
        cropImageToSquare(file);
    }
}

// Create a square cropped version of the selected image
function cropImageToSquare(file) {
    const previewImage = document.getElementById('profile-image-preview');
    const secondPreviewImage = document.getElementById('preview-profile-image');
    
    // Create temporary URL for the file
    const objectUrl = URL.createObjectURL(file);
    
    // Load the image to get its dimensions
    const img = new Image();
    img.onload = function() {
        // Create a canvas element for cropping - EXACT SAME SIZE as camera (300x300)
        const canvas = document.createElement('canvas');
        canvas.width = 300;  // Match camera canvas width
        canvas.height = 300; // Match camera canvas height
        
        // Get the dimensions for cropping
        const size = Math.min(img.width, img.height);
        const offsetX = (img.width - size) / 2;
        const offsetY = (img.height - size) / 2;
        
        // Draw the cropped image to the canvas with high quality settings
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
            img,
            offsetX, offsetY,     // Start position of the crop in the original image
            size, size,           // Size of the square to crop
            0, 0,                 // Place at 0,0 on canvas
            300, 300              // Size on canvas (300x300 rectangle) - match camera output
        );
        
        // Convert the canvas to a blob with same quality setting as camera (0.9)
        canvas.toBlob(function(blob) {
            // Create new object URLs from the blob
            const croppedUrl = URL.createObjectURL(blob);
            
            // Update preview images
            previewImage.src = croppedUrl;
            secondPreviewImage.src = croppedUrl;
            
            // Store the blob for later upload when the profile form is submitted
            window.capturedProfileImage = blob;
            
            // Create a File object from the blob to replace the original file input
            const fileName = `profile-cropped-${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            
            // Create a FileList-like object
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            
            // Replace the file input's files property with our cropped image
            const fileInput = document.getElementById('profile-image');
            fileInput.files = dataTransfer.files;
            
            // Clean up to prevent memory leaks
            URL.revokeObjectURL(objectUrl);
            
            // Schedule cleanup of the cropped URL after the images are loaded
            previewImage.onload = function() {
                setTimeout(() => URL.revokeObjectURL(croppedUrl), 3000);
            };
        }, 'image/jpeg', 0.9); // Exactly match camera quality setting (0.9)
    };
    
    img.onerror = function() {
        console.error('Error loading image for cropping');
        URL.revokeObjectURL(objectUrl);
        
        // Set to placeholder if there's an error
        previewImage.src = 'img/placeholder-profile.png';
        secondPreviewImage.src = 'img/placeholder-profile.png';
        
        // Show notification about the error
        showNotification('Error', 'Could not process the selected image. Please try another image.', 'error');
    };
    
    // Set the source to trigger loading
    img.src = objectUrl;
}

// Set up notification method change handlers
function setupNotificationMethodHandlers() {
    // First remove any existing event listeners by cloning and replacing the radio buttons
    const replaceRadioListeners = (name) => {
        const radios = document.querySelectorAll(`input[name="${name}"]`);
        radios.forEach(radio => {
            const newRadio = radio.cloneNode(true);
            radio.parentNode.replaceChild(newRadio, radio);
        });
        
        // Now add fresh event listeners
        document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
            radio.addEventListener('change', async function() {
                if (this.name === 'notification-method') {
                    await handleNotificationChange();
                }
                updatePhoneFieldsVisibility();
            });
        });
    };
    
    // Apply to new sets of radio buttons
    replaceRadioListeners('content-delivery');
    replaceRadioListeners('notification-method');
    
    // Setup real-time validation for the single mobile number field
    const mobileInput = document.getElementById('profile-mobile');
    
    if (mobileInput) {
        const newMobileInput = mobileInput.cloneNode(true);
        mobileInput.parentNode.replaceChild(newMobileInput, mobileInput);
        newMobileInput.addEventListener('input', function() {
            // Check if field is required but empty
            if (this.hasAttribute('required') && this.value.trim() === '') {
                this.classList.add('is-invalid');
                return;
            }
            
            // If field has a value, validate it's 11 digits and starts with 0
            if (this.value.trim() !== '') {
                const phoneNumber = this.value.trim().replace(/\s+/g, '');
                const isValid = /^0\d{10}$/.test(phoneNumber);
                
                if (!isValid) {
                    this.classList.add('is-invalid');
                    this.nextElementSibling.nextElementSibling.innerHTML = 'Please enter a valid 11-digit UK mobile number starting with 0';
                } else {
                    this.classList.remove('is-invalid');
                }
            } else {
                this.classList.remove('is-invalid');
            }
        });
    }
}

// Set up the test notification button
function setupTestNotificationButton() {
    const testButton = document.getElementById('test-notification-btn');
    
    if (testButton) {
        // Remove any existing event listeners
        const newButton = testButton.cloneNode(true);
        testButton.parentNode.replaceChild(newButton, testButton);
        
        // Add the click handler
        newButton.addEventListener('click', async function() {
            try {
                // Disable button during request
                this.disabled = true;
                this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...';
                
                // Check if user has permission
                if (Notification.permission !== 'granted') {
                    showNotification('Permission Required', 'Notifications must be enabled before testing. Please enable them first.', 'warning');
                    return;
                }
                
                // Send test notification (make sure testPushNotification is available)
                if (window.testPushNotification) {
                    const result = await window.testPushNotification();
                    
                    if (result) {
                        showNotification('Test Sent', 'Test notification sent successfully! Check your notification tray.', 'success');
                    } else {
                        showNotification('Test Failed', 'Failed to send test notification. Please try again.', 'error');
                    }
                } else {
                    console.error('testPushNotification function not available');
                    showNotification('Error', 'Test notification function not available.', 'error');
                }
                
            } catch (error) {
                console.error('Error sending test notification:', error);
                showNotification('Error', `Failed to send test notification: ${error.message}`, 'error');
            } finally {
                // Re-enable button
                this.disabled = false;
                this.innerHTML = '<i class="bi bi-bell me-2"></i>Send Test Notification';
            }
        });
    }
}

// Helper function to ensure no hidden fields have required attribute
function disableHiddenRequiredFields() {
    // Get all required inputs
    const requiredInputs = document.querySelectorAll('input[required], select[required], textarea[required]');
    
    requiredInputs.forEach(input => {
        // Check if the input is hidden (either directly or inside a hidden container)
        if (isHidden(input)) {
            // Temporarily remove required attribute to prevent validation errors
            input.removeAttribute('required');
            // Flag it so we can restore later if needed
            input.dataset.wasRequired = 'true';
        }
    });
    
    // Helper to check if an element is hidden
    function isHidden(el) {
        // Check if the element itself is hidden
        if (el.style.display === 'none' || el.classList.contains('d-none')) return true;
        
        // Check if any parent container is hidden (recursive check up the DOM)
        let parent = el.parentElement;
        while (parent) {
            if (parent.style.display === 'none' || parent.classList.contains('d-none')) {
                return true;
            }
            parent = parent.parentElement;
        }
        
        return false;
    }
}

// Update phone fields visibility based on notification method selections
function updatePhoneFieldsVisibility() {
    // Hide phone fields for now since SMS/WhatsApp are dormant
    const phoneNumberSection = document.getElementById('phone-number-section');
    
    if (phoneNumberSection) {
        phoneNumberSection.classList.add('d-none');
    }
    
    // Always remove required attribute from mobile number when using simplified notifications
    const mobileInput = document.getElementById('profile-mobile');
    if (mobileInput) {
        mobileInput.removeAttribute('required');
        mobileInput.classList.remove('is-invalid');
    }
    
    // Run this directly after changing visibility
    disableHiddenRequiredFields();
}

// Helper function to update all profile images in the UI
function updateAllProfileImages(imageUrl) {
    // List of all elements that should show the profile image
    const imageElements = [
        document.getElementById('preview-profile-image'),       // Prayer card preview
        document.getElementById('profile-image-preview')        // Upload preview
    ];
    
    // Update each element if it exists
    imageElements.forEach(img => {
        if (img) {
            img.src = imageUrl;
        }
    });
}

// Setup handlers for calendar hide option
function setupCalendarHideHandlers() {
    const calendarHideCheckbox = document.getElementById('profile-calendar-hide');
    if (calendarHideCheckbox) {
        // Remove existing listeners
        const newCheckbox = calendarHideCheckbox.cloneNode(true);
        calendarHideCheckbox.parentNode.replaceChild(newCheckbox, calendarHideCheckbox);
        
        // Add event listener for checkbox changes
        newCheckbox.addEventListener('change', updateCalendarHideVisibility);
    }
}

// Update visibility based on calendar hide option
function updateCalendarHideVisibility() {
    const calendarHideCheckbox = document.getElementById('profile-calendar-hide');
    const prayerPointsSection = document.getElementById('profile-prayer-points').closest('.mb-3');
    // Find the card with the title "Your Prayer Card"
    const previewCardSection = document.querySelector('.col-md-6 .card.shadow');
    
    if (calendarHideCheckbox && calendarHideCheckbox.checked) {
        // Hide prayer points and preview if checkbox is checked
        if (prayerPointsSection) prayerPointsSection.classList.add('d-none');
        if (previewCardSection) previewCardSection.classList.add('d-none');
    } else {
        // Show prayer points and preview if checkbox is not checked
        if (prayerPointsSection) prayerPointsSection.classList.remove('d-none');
        if (previewCardSection) previewCardSection.classList.remove('d-none');
    }
}

// Update the profile preview card
function updateProfilePreview() {
    const nameInput = document.getElementById('profile-name');
    const photoTagInput = document.getElementById('profile-photo-tag');
    const prayerPointsInput = document.getElementById('profile-prayer-points');
    
    const previewName = document.getElementById('preview-name');
    const previewPrayerPoints = document.getElementById('preview-prayer-points');
    
    // Update preview values - use photo tag if available, otherwise use name
    previewName.textContent = (photoTagInput && photoTagInput.value) ? photoTagInput.value : (nameInput.value || 'Your Name');
    
    if (prayerPointsInput.value) {
        previewPrayerPoints.innerHTML = `<p>${prayerPointsInput.value.replace(/\n/g, '</p><p>')}</p>`;
    } else {
        previewPrayerPoints.innerHTML = '';
    }
}

// Variables for GDPR consent
let profileDataToSave = null;
let profileSubmitButton = null;
let gdprModal = null;

// Show GDPR consent modal
function showGdprConsentModal() {
    // Get the modal element
    const modalElement = document.getElementById('gdpr-consent-modal');
    gdprModal = new bootstrap.Modal(modalElement);
    
    // Set up the event listeners
    document.getElementById('gdpr-consent-check').addEventListener('change', function() {
        document.getElementById('gdpr-consent-submit').disabled = !this.checked;
    });
    
    // Handle modal hidden event - ensure we clean up backdrop
    modalElement.addEventListener('hidden.bs.modal', function() {
        // Remove the backdrop manually if it's still present
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.parentNode.removeChild(backdrop);
        }
        // Restore body classes
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        
        // Reset button state if user canceled
        if (profileDataToSave && profileDataToSave.submitBtn) {
            profileDataToSave.submitBtn.textContent = profileDataToSave.originalText;
            profileDataToSave.submitBtn.disabled = false;
        }
    });
    
    // Handle cancel button
    document.getElementById('gdpr-consent-cancel').addEventListener('click', function() {
        gdprModal.hide();
        // Reset button state
        if (profileDataToSave && profileDataToSave.submitBtn) {
            profileDataToSave.submitBtn.textContent = profileDataToSave.originalText;
            profileDataToSave.submitBtn.disabled = false;
            showNotification('Info', 'Profile save canceled. You must accept the data privacy notice to save your profile.');
        }
    });
    
    document.getElementById('gdpr-consent-submit').addEventListener('click', async function() {
        try {
            // Complete the profile save with GDPR consent
            if (profileDataToSave) {
                profileDataToSave.gdprAccepted = true;
                await updateProfileViaEdgeFunction(profileDataToSave);
            }
        } finally {
            // Ensure modal is properly disposed
            gdprModal.hide();
            setTimeout(() => {
                gdprModal.dispose();
            }, 500);
        }
    });
    
    // Show the modal
    gdprModal.show();
}

// Save the user's profile
async function saveProfile(e) {
    e.preventDefault();
    
    console.log('🔄 Profile save started');
    
    // Ensure no hidden form fields have required attribute
    disableHiddenRequiredFields();
    
    const submitBtn = e.submitter;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;
    
    try {
        // Get name from profile as it's now read-only
        const fullName = userProfile.full_name || currentUser.user_metadata?.full_name || currentUser.email || '';
        const photoTag = document.getElementById('profile-photo-tag').value.trim();
        const calendarHide = document.getElementById('profile-calendar-hide').checked;
        const prayerPoints = document.getElementById('profile-prayer-points').value.trim();
        const mobileNumber = document.getElementById('profile-mobile').value.trim();
        
        // Get the content delivery preference
        const contentDelivery = document.querySelector('input[name="content-delivery"]:checked').value;
        // Determine if email should be used based on the selection
        const contentDeliveryEmail = contentDelivery === 'app-email';
        
        // Get the notification method using the new simplified method
        const notificationSettings = saveProfileNotificationSettings();
        let notificationMethod = notificationSettings.notification_method;
        
        // Validate mobile number (currently not needed since SMS/WhatsApp are dormant)
        const mobileInput = document.getElementById('profile-mobile');
        if (mobileInput) mobileInput.classList.remove('is-invalid');
        
        // Prepare profile data object
        const profileData = {
            fullName,
            photoTag,
            calendarHide,
            prayerPoints,
            mobileNumber,
            contentDeliveryEmail,
            notificationMethod,
            submitBtn,
            originalText
        };
        
        // Check if user has accepted GDPR
        if (!userProfile.gdpr_accepted) {
            // Store the profile data and button for later
            profileDataToSave = profileData;
            
            // Store submit button for later
            profileSubmitButton = submitBtn;
            
            // Show GDPR consent modal
            showGdprConsentModal();
            return;
        }
        
        // If we get here, user has already accepted GDPR
        await updateProfileViaEdgeFunction(profileData);
        
    } catch (error) {
        console.error('Error saving profile:', error);
        showNotification('Error', `Failed to save profile: ${error.message}`);
        
        // Reset button state
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Update profile via Edge Function with universal page refresh
async function updateProfileViaEdgeFunction(data) {
    // Set a timeout to ensure button state is always restored
    const TIMEOUT_MS = 15000; // 15 seconds
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Update timeout exceeded')), TIMEOUT_MS);
    });
    
    // Create a timer to reset the button state regardless of outcome
    const buttonResetTimer = setTimeout(() => {
        console.log('⏰ Safety timer: resetting button state');
        data.submitBtn.textContent = data.originalText;
        data.submitBtn.disabled = false;
    }, TIMEOUT_MS + 1000); // 1 second after the timeout
    
    try {
        console.log('🔄 Starting profile update via Edge Function');
        
        // Get current profile image URL (fallback)
        const oldImageUrl = userProfile.profile_image_url || null;
        const profileImage = document.getElementById('profile-image').files[0];
        
        // Determine if GDPR was accepted in this save
        const gdprAccepted = data.gdprAccepted === true ? true : userProfile.gdpr_accepted || false;
        
        // Process mobile number (drop the leading 0 and add +44)
        let formattedPhoneNumber = '';
        
        // Process mobile number if provided
        if (data.mobileNumber) {
            // Remove any spaces
            const cleanNumber = data.mobileNumber.trim().replace(/\s+/g, '');
            // Check if it's a valid UK number (starts with 0 and has 11 digits)
            if (/^0\d{10}$/.test(cleanNumber)) {
                // Remove the 0 and add +44
                formattedPhoneNumber = "+44" + cleanNumber.substring(1);
                console.log('Formatted mobile number:', formattedPhoneNumber);
            } else {
                console.warn('Mobile number not in correct format, not converting to international format');
                formattedPhoneNumber = cleanNumber;
            }
        }

        // Prepare profile data for the Edge Function - now using the new fields
        const profileDataForUpdate = {
            full_name: data.fullName,
            photo_tag: data.photoTag,
            calendar_hide: data.calendarHide,
            prayer_points: data.prayerPoints,
            profile_image_url: oldImageUrl, // Will be updated by Edge Function if a new image is provided
            phone_number: formattedPhoneNumber,
            whatsapp_number: formattedPhoneNumber, // Same number is used for both SMS and WhatsApp
            content_delivery_email: data.contentDeliveryEmail, // NEW FIELD
            notification_method: data.notificationMethod, // NEW FIELD
            profile_set: true, // Mark profile as completed
            gdpr_accepted: gdprAccepted, // Set GDPR acceptance status
            updated_at: new Date().toISOString()
        };
        
        // Process the image if one is selected
        let imageData = null;
        if (profileImage) {
            try {
                console.log('🖼️ Profile image detected, preparing for upload');
                // Convert to base64
                imageData = await fileToBase64(profileImage);
            } catch (imageError) {
                console.error('❌ Error preparing image:', imageError);
                // Continue without image - the Edge Function will handle profile update only
            }
        }
        
        // Define the Edge Function URL
        const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/update-profile`;
        
        // Prepare the payload for the Edge Function
        const payload = {
            profileData: profileDataForUpdate,
            imageData: imageData,
            userId: getUserId(),
            oldImageUrl: oldImageUrl
        };
        
        // Get the auth token
        const authToken = window.authToken || await getAuthToken();
        
        console.log('📡 Sending data to Edge Function...');
        
        // Use Promise.race to implement timeout
        const response = await Promise.race([
            fetch(edgeFunctionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(payload)
            }),
            timeoutPromise
        ]);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Edge Function error:', response.status, errorText);
            throw new Error(`Update failed (${response.status}): ${errorText}`);
        }
        
        // Parse the response
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Unknown error updating profile');
        }
        
        console.log('✅ Profile updated successfully via Edge Function');
        
        // If the image was updated, update the UI
        if (result.imageUrl) {
            updateAllProfileImages(result.imageUrl);
        }
        
        // Use the profile data returned from the Edge Function
        // instead of making another Supabase SDK call that could stall
        if (result.profile) {
            userProfile = result.profile;
            console.log('📊 Updated profile data from Edge Function:', userProfile);
        }
        
        // Show a success notification
        showNotification('Success', 'Profile saved successfully!');
        
    } catch (error) {
        console.error('❌ Error in updateProfileViaEdgeFunction:', error);
        showNotification('Error', `Failed to save profile: ${error.message}`);
    } finally {
        // Clear the safety timer since we're in the finally block
        clearTimeout(buttonResetTimer);
        
        // Reset button state
        data.submitBtn.textContent = data.originalText;
        data.submitBtn.disabled = false;
        console.log('🏁 Profile update process completed');
    }
}

// Helper function to get auth token
async function getAuthToken() {
    await window.waitForAuthStability();
    try {
        const { data } = await supabase.auth.getSession();
        return data?.session?.access_token;
    } catch (error) {
        console.error('Error getting auth token:', error);
        throw new Error('Unable to get authentication token');
    }
}

// Convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}