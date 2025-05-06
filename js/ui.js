// UI Management Module - Bootstrap Version

// Initialize UI when document is loaded
document.addEventListener('DOMContentLoaded', initUI);

function initUI() {
    setupNavigation();
    setupModalClosers();
    setupFileInputs();
    initializeBootstrapComponents();
    setupDatePickerTrigger();
}

// Setup navigation between views
function setupNavigation() {
    // Initialize global flag to track navigation
    window.navigationInProgress = false;
    
    // Event handler creator to prevent duplicate calls
    const createNavHandler = (viewId, loaderFunction) => {
        return function(e) {
            // Prevent default if it's a link
            if (e) e.preventDefault();
            
            // Check if navigation is already in progress to prevent duplicate calls
            if (window.navigationInProgress) {
                console.log(`Navigation to ${viewId} ignored - already in progress`);
                return;
            }
            
            // Set the flag to prevent duplicate calls
            window.navigationInProgress = true;
            console.log(`Navigation started: ${viewId}`);
            
            // Show the view
            showView(viewId);
            
            // Call the loader function if provided
            if (typeof loaderFunction === 'function') {
                try {
                    loaderFunction();
                } catch (err) {
                    console.error(`Error in loader function for ${viewId}:`, err);
                    showToast('Error', `Could not load ${viewId}. Please refresh the page.`, 'error');
                }
            }
            
            // Reset the flag after a delay to prevent rapid clicking
            setTimeout(() => {
                window.navigationInProgress = false;
                console.log(`Navigation completed: ${viewId}`);
            }, 500);
        };
    };
    
    // Main navigation items
    document.getElementById('nav-calendar').addEventListener('click', 
        createNavHandler('calendar-view', loadPrayerCalendar));
    
    document.getElementById('nav-updates').addEventListener('click', 
        createNavHandler('updates-view', loadPrayerUpdates));
    
    document.getElementById('nav-urgent').addEventListener('click', 
        createNavHandler('urgent-view', loadUrgentPrayers));
    
    document.getElementById('nav-profile').addEventListener('click', 
        createNavHandler('profile-view', () => {
            // Load profile with a slight delay to ensure DOM is ready
            setTimeout(loadUserProfile, 50);
        }));
        
    document.getElementById('nav-preferences').addEventListener('click', 
        createNavHandler('preferences-view', () => {
            // Load preferences with a slight delay to ensure DOM is ready
            setTimeout(loadUserPreferences, 50);
        }));
    
    // Admin navigation
    document.getElementById('nav-manage-users').addEventListener('click', 
        createNavHandler('manage-users-view', loadUsers));
    
    document.getElementById('nav-manage-calendar').addEventListener('click', 
        createNavHandler('manage-calendar-view', loadCalendarAdmin));
    
    document.getElementById('nav-manage-updates').addEventListener('click', 
        createNavHandler('manage-updates-view', () => {
            initUpdateEditor();
            loadUpdatesAdmin();
        }));
    
    document.getElementById('nav-manage-urgent').addEventListener('click', 
        createNavHandler('manage-urgent-view', () => {
            initUrgentEditor();
            loadUrgentAdmin();
        }));
    
    document.getElementById('nav-test-email').addEventListener('click', 
        createNavHandler('test-email-view', initEmailTestView));
    
    // Make the nav handlers available globally for direct calls
    window.navHandlers = {
        calendar: createNavHandler('calendar-view', loadPrayerCalendar),
        updates: createNavHandler('updates-view', loadPrayerUpdates),
        urgent: createNavHandler('urgent-view', loadUrgentPrayers),
        profile: createNavHandler('profile-view', () => setTimeout(loadUserProfile, 50)),
        preferences: createNavHandler('preferences-view', () => setTimeout(loadUserPreferences, 50)),
        manageUsers: createNavHandler('manage-users-view', loadUsers),
        manageCalendar: createNavHandler('manage-calendar-view', loadCalendarAdmin),
        manageUpdates: createNavHandler('manage-updates-view', () => {
            initUpdateEditor();
            loadUpdatesAdmin();
        }),
        manageUrgent: createNavHandler('manage-urgent-view', () => {
            initUrgentEditor();
            loadUrgentAdmin();
        }),
        testEmail: createNavHandler('test-email-view', initEmailTestView)
    };
}

// Setup the date picker trigger for testing
function setupDatePickerTrigger() {
    // Now works with either the prayer title or the navbar brand (app title)
    const titleElements = [
        document.getElementById('daily-prayer-title'),
        document.querySelector('.navbar-brand')
    ];
    
    // Set up tap counter
    let tapCount = 0;
    let tapTimer = null;
    
    titleElements.forEach(titleElement => {
        if (titleElement) {
            titleElement.addEventListener('click', (e) => {
                // Increment tap counter for any click on the title elements
                tapCount++;
                
                // Log for debugging
                console.log(`Title tap detected: ${tapCount}/5`);
                
                // Reset tap counter after 3 seconds
                clearTimeout(tapTimer);
                tapTimer = setTimeout(() => {
                    tapCount = 0;
                }, 3000);
                
                // Check if we've reached 5 taps
                if (tapCount >= 5) {
                    // Reset counter
                    tapCount = 0;
                    
                    // Show date picker modal
                    showDatePickerModal();
                }
            });
        }
    });
    
    // Set up event listeners for the date picker modal
    document.getElementById('set-test-date').addEventListener('click', () => {
        const dateInput = document.getElementById('test-date');
        if (dateInput.value) {
            testDate = new Date(dateInput.value);
            
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('date-picker-modal'));
            if (modal) modal.hide();
            
            // Reload the prayer calendar
            loadPrayerCalendar();
            
            // Show confirmation
            showToast('Test Mode', `Date set to ${formatDate(testDate)}`, 'warning');
        }
    });
    
    document.getElementById('reset-test-date').addEventListener('click', () => {
        testDate = null;
        
        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('date-picker-modal'));
        if (modal) modal.hide();
        
        // Reload the prayer calendar
        loadPrayerCalendar();
        
        // Show confirmation
        showToast('Test Mode', 'Date reset to today', 'success');
    });
}

// Show the date picker modal
function showDatePickerModal() {
    // Set the current date as default
    const dateInput = document.getElementById('test-date');
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    dateInput.value = formattedDate;
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('date-picker-modal'));
    modal.show();
}

// Function to show a specific view and hide others
function showView(viewId) {
    // Hide all views
    const views = document.querySelectorAll('.view-content');
    views.forEach(view => {
        view.classList.add('d-none');
    });
    
    // Show the selected view
    document.getElementById(viewId).classList.remove('d-none');
    
    // Close mobile menu if open
    const navbarCollapse = document.getElementById('navbarBasic');
    const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse);
    if (bsCollapse && navbarCollapse.classList.contains('show')) {
        bsCollapse.hide();
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
}

// Make showView globally accessible for drawer navigation
window.showView = showView;

// Setup modal close buttons
function setupModalClosers() {
    // Bootstrap handles most modal closing automatically
    // We just need to set up specific button actions
    
    // Close notification modal specifically
    const closeNotificationBtn = document.getElementById('close-notification');
    if (closeNotificationBtn) {
        closeNotificationBtn.addEventListener('click', () => {
            try {
                const modal = bootstrap.Modal.getInstance(document.getElementById('notification-modal'));
                if (modal) {
                    modal.hide();
                }
            } catch (error) {
                console.error('Error closing notification modal:', error);
                // Fallback to manual cleanup
                cleanupModalBackdrops();
            }
        });
    }
    
    // Close card view modal
    const closeCardBtn = document.getElementById('close-card-modal');
    if (closeCardBtn) {
        closeCardBtn.addEventListener('click', () => {
            try {
                const modal = bootstrap.Modal.getInstance(document.getElementById('view-card-modal'));
                if (modal) {
                    modal.hide();
                }
            } catch (error) {
                console.error('Error closing card modal:', error);
                // Fallback to manual cleanup
                cleanupModalBackdrops();
            }
        });
    }
    
    // Set up global modal event handlers for all modals
    document.addEventListener('hidden.bs.modal', function (event) {
        // Make sure body classes and styles are reset
        setTimeout(() => {
            cleanupModalBackdrops();
        }, 100);
    });
}

// Toast notification system
let toastCounter = 0;
const activeToasts = new Map();

/**
 * Show a toast notification
 * @param {string} title - The toast title
 * @param {string} message - The toast message
 * @param {string} type - The type of toast: 'info', 'success', 'warning', 'error', or 'processing'
 * @param {number} duration - Duration in ms (0 for persistent toast that requires manual dismissal)
 * @returns {string} - Toast ID that can be used to dismiss the toast
 */
function showToast(title, message, type = 'info', duration = 5000) {
    console.log(`Showing toast: ${title} (${type})`);
    
    // Increment the counter for unique IDs
    toastCounter++;
    const toastId = `toast-${toastCounter}`;
    
    // Get background color based on type
    let bgColor, iconClass, progressBarColor;
    switch (type) {
        case 'success':
            bgColor = 'bg-success text-white';
            iconClass = 'bi-check-circle-fill';
            progressBarColor = 'bg-light';
            break;
        case 'warning':
            bgColor = 'bg-warning text-dark';
            iconClass = 'bi-exclamation-triangle-fill';
            progressBarColor = 'bg-dark';
            break;
        case 'error':
            bgColor = 'bg-danger text-white';
            iconClass = 'bi-x-circle-fill';
            progressBarColor = 'bg-light';
            break;
        case 'processing':
            bgColor = 'bg-primary text-white';
            iconClass = 'bi-arrow-repeat';
            progressBarColor = 'bg-light';
            break;
        default: // info
            bgColor = 'bg-info text-white';
            iconClass = 'bi-info-circle-fill';
            progressBarColor = 'bg-light';
    }
    
    // Create the toast element
    const toastElement = document.createElement('div');
    toastElement.className = `toast ${bgColor} mb-3`;
    toastElement.id = toastId;
    toastElement.setAttribute('role', 'alert');
    toastElement.setAttribute('aria-live', 'assertive');
    toastElement.setAttribute('aria-atomic', 'true');
    
    // Add a spinning animation for processing toasts
    const iconAnimation = type === 'processing' ? 'spin-animation' : '';
    
    // Toast content
    toastElement.innerHTML = `
        <div class="toast-header ${bgColor} border-0">
            <i class="bi ${iconClass} me-2 ${iconAnimation}"></i>
            <strong class="me-auto">${title}</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            ${message}
            ${duration > 0 ? `<div class="progress mt-2" style="height: 3px">
                <div class="progress-bar ${progressBarColor}" role="progressbar" style="width: 100%"></div>
            </div>` : ''}
        </div>
    `;
    
    // Add to DOM
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
        toastContainer.appendChild(toastElement);
    } else {
        // Fallback: Add to body if container doesn't exist
        document.body.appendChild(toastElement);
    }
    
    // Initialize bootstrap toast
    const toastInstance = new bootstrap.Toast(toastElement, {
        autohide: duration > 0,
        delay: duration
    });
    
    // Add CSS for spinning icon if needed
    if (type === 'processing') {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .spin-animation {
                display: inline-block;
                animation: spinner-border 2s linear infinite;
            }
        `;
        document.head.appendChild(styleElement);
    }
    
    // Store toast instance for later reference
    activeToasts.set(toastId, {
        instance: toastInstance,
        element: toastElement
    });
    
    // Add event listener for when toast is hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        // Remove toast from DOM after it's hidden
        if (toastElement.parentNode) {
            toastElement.parentNode.removeChild(toastElement);
        }
        // Remove from active toasts map
        activeToasts.delete(toastId);
    });
    
    // Show the toast
    toastInstance.show();
    
    // Animate progress bar if duration is set
    if (duration > 0) {
        const progressBar = toastElement.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.transition = `width ${duration}ms linear`;
            setTimeout(() => {
                progressBar.style.width = '0%';
            }, 100); // Small delay to ensure transition is applied
        }
    }
    
    return toastId;
}

/**
 * Dismiss a specific toast by ID
 * @param {string} toastId - The ID of the toast to dismiss
 */
function dismissToast(toastId) {
    const toast = activeToasts.get(toastId);
    if (toast) {
        toast.instance.hide();
    }
}

/**
 * Dismiss all active toasts
 */
function dismissAllToasts() {
    activeToasts.forEach((toast) => {
        toast.instance.hide();
    });
}

/**
 * Update an existing toast
 * @param {string} toastId - The ID of the toast to update
 * @param {object} options - The properties to update
 */
function updateToast(toastId, options = {}) {
    const toast = activeToasts.get(toastId);
    if (!toast) return;
    
    const { title, message, type } = options;
    
    // Update title if provided
    if (title) {
        const headerElement = toast.element.querySelector('.toast-header strong');
        if (headerElement) {
            headerElement.textContent = title;
        }
    }
    
    // Update message if provided
    if (message) {
        const bodyElement = toast.element.querySelector('.toast-body');
        if (bodyElement) {
            // Preserve the progress bar if it exists
            const progressBar = bodyElement.querySelector('.progress');
            bodyElement.innerHTML = message;
            if (progressBar) {
                bodyElement.appendChild(progressBar);
            }
        }
    }
    
    // Update type/appearance if provided
    if (type) {
        // Implementation for changing toast type would go here
        // This is more complex as it requires changing multiple classes
    }
}

// Helper function to clean up modal backdrops and body classes
function cleanupModalBackdrops() {
    console.log('Running modal cleanup');
    
    try {
        // Remove any stray backdrops
        const backdrops = document.querySelectorAll('.modal-backdrop');
        console.log(`Found ${backdrops.length} modal backdrops to clean up`);
        
        backdrops.forEach(backdrop => {
            if (backdrop && backdrop.parentNode) {
                backdrop.parentNode.removeChild(backdrop);
            }
        });
        
        // Check if there are any visible modals
        const visibleModals = document.querySelectorAll('.modal.show');
        
        if (visibleModals.length === 0) {
            console.log('No visible modals - cleaning up body classes');
            // Clean up body classes and styles only if no visible modals
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        } else {
            console.log(`${visibleModals.length} modals still visible - keeping body classes`);
        }
        
        // Fix any modals that are hidden but still have show class
        const hiddenButShowModals = document.querySelectorAll('.modal.show[style*="display: none"]');
        hiddenButShowModals.forEach(modal => {
            console.log('Fixing hidden modal with show class:', modal.id);
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            modal.removeAttribute('aria-modal');
        });
        
        return true;
    } catch (error) {
        console.error('Error in cleanupModalBackdrops:', error);
        return false;
    }
}

// Setup file input display
function setupFileInputs() {
    // Generic function to handle file input changes
    function handleFileInput(fileInput, fileNameElement, previewElement) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                const fileName = fileInput.files[0].name;
                
                // Add null check before setting textContent
                if (fileNameElement) {
                    fileNameElement.textContent = fileName;
                }
                
                // If preview element exists, show image preview
                if (previewElement) {
                    previewElement.classList.remove('d-none');
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        previewElement.src = e.target.result;
                    };
                    reader.readAsDataURL(fileInput.files[0]);
                }
            } else {
                // Add null check here too
                if (fileNameElement) {
                    fileNameElement.textContent = 'No file selected';
                }
                if (previewElement) {
                    previewElement.classList.add('d-none');
                }
            }
        });
    }
    
    // Profile image input
    const profileInput = document.getElementById('profile-image');
    const profileName = document.getElementById('profile-image-name');
    const profilePreview = document.getElementById('profile-image-preview');
    if (profileInput) {
        handleFileInput(profileInput, profileName, profilePreview);
    }
    
    // Calendar entry image input
    const calendarInput = document.getElementById('calendar-image');
    const calendarName = document.getElementById('calendar-image-name');
    const calendarPreview = document.getElementById('calendar-image-preview');
    if (calendarInput) {
        handleFileInput(calendarInput, calendarName, calendarPreview);
    }
    
    // Edit calendar entry image input
    const editCalendarInput = document.getElementById('edit-calendar-image');
    const editCalendarName = document.getElementById('edit-calendar-image-name');
    const editCalendarPreview = document.getElementById('edit-calendar-image-preview');
    if (editCalendarInput) {
        handleFileInput(editCalendarInput, editCalendarName, editCalendarPreview);
    }
}

// Initialize Bootstrap component functionality
function initializeBootstrapComponents() {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize day of month dropdown options
    const dayDropdowns = document.querySelectorAll('#calendar-day, #edit-calendar-day');
    dayDropdowns.forEach(dropdown => {
        for (let i = 1; i <= 31; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            dropdown.appendChild(option);
        }
    });
}

// Simple notification variable to track current notification
let currentNotificationModal = null;

// Show notification modal
function showNotification(title, message) {
    try {
        console.log(`Showing notification: ${title}`);
        
        // Use simple alert as fallback for critical messages in case modal system is unstable
        if (title.includes('Error')) {
            console.log('Using alert for error message for reliability');
            setTimeout(() => alert(`${title}: ${message.replace(/<[^>]*>/g, '')}`), 100);
            return;
        }
        
        // Get the modal element
        const modalElement = document.getElementById('notification-modal');
        if (!modalElement) {
            console.error('Notification modal element not found');
            alert(`${title}: ${message.replace(/<[^>]*>/g, '')}`);
            return;
        }
        
        // Get title and content elements
        const titleElem = document.getElementById('notification-title');
        const contentElem = document.getElementById('notification-content');
        
        if (!titleElem || !contentElem) {
            console.error('Notification modal elements not found');
            alert(`${title}: ${message.replace(/<[^>]*>/g, '')}`);
            return;
        }
        
        // Clean up any existing modal
        if (currentNotificationModal) {
            try {
                currentNotificationModal.hide();
                currentNotificationModal.dispose();
            } catch (e) {
                console.warn('Error cleaning up previous modal instance:', e);
            }
            currentNotificationModal = null;
        }
        
        // Update content first
        titleElem.textContent = title;
        contentElem.innerHTML = message;
        
        // Ensure the close button has the right event handler
        setupNotificationCloseButton();
        
        // Create a new modal instance
        try {
            currentNotificationModal = new bootstrap.Modal(modalElement, {
                backdrop: true,
                keyboard: true,
                focus: true
            });
            
            // Show the modal
            currentNotificationModal.show();
            
            // Add listener for modal hidden event
            modalElement.addEventListener('hidden.bs.modal', function onHidden() {
                // Remove this listener to avoid memory leaks
                modalElement.removeEventListener('hidden.bs.modal', onHidden);
                
                // Clean up the modal instance
                if (currentNotificationModal) {
                    try {
                        currentNotificationModal.dispose();
                    } catch (e) {
                        console.warn('Error disposing modal after hide:', e);
                    }
                    currentNotificationModal = null;
                }
                
                // Clean up backdrops
                cleanupModalBackdrops();
            });
            
        } catch (error) {
            console.error('Error initializing Bootstrap modal:', error);
            alert(`${title}: ${message.replace(/<[^>]*>/g, '')}`);
        }
    } catch (error) {
        console.error('Error showing notification:', error);
        // Fallback to alert if modal fails
        alert(`${title}: ${message.replace(/<[^>]*>/g, '')}`);
    }
}

// Function to set up notification close button
function setupNotificationCloseButton() {
    const closeButton = document.getElementById('close-notification');
    if (!closeButton) return;
    
    // Clone and replace to remove all event listeners
    const newCloseButton = closeButton.cloneNode(true);
    closeButton.parentNode.replaceChild(newCloseButton, closeButton);
    
    // Add a new event listener
    newCloseButton.addEventListener('click', function(event) {
        console.log('Notification close button clicked');
        
        // Prevent default behavior
        event.preventDefault();
        event.stopPropagation();
        
        // Reference the modal element directly
        const modalElement = document.getElementById('notification-modal');
        
        // Try to use Bootstrap's API first
        if (currentNotificationModal) {
            try {
                currentNotificationModal.hide();
                return;
            } catch (e) {
                console.warn('Error hiding modal with Bootstrap API:', e);
            }
        }
        
        // Fallback to direct DOM manipulation
        try {
            if (modalElement) {
                modalElement.classList.remove('show');
                modalElement.style.display = 'none';
                modalElement.setAttribute('aria-hidden', 'true');
                modalElement.removeAttribute('aria-modal');
            }
            
            // Remove backdrops
            cleanupModalBackdrops();
            
            // Reset body
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        } catch (e) {
            console.error('Error with manual modal cleanup:', e);
            // Force page reload as last resort
            window.location.reload();
        }
    });
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

// Create loading spinner
function createLoadingSpinner() {
    return `<div class="text-center p-5">
        <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
            <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-3">Loading...</p>
    </div>`;
}

// Helper function to create a prayer card
function createPrayerCard(entry) {
    // Remove default text when no prayer points are provided
    const prayerPointsContent = entry.prayer_points ? `<div class="card-text flex-grow-1">${entry.prayer_points}</div>` : '';
    
    return `
    <div class="col mb-4">
        <div class="card prayer-card h-100 shadow-sm">
            <div class="image-container">
                <img src="${entry.image_url || 'img/placeholder-profile.png'}" 
                     class="card-img-top prayer-profile-img" 
                     alt="${entry.name}">
            </div>
            <div class="card-body d-flex flex-column">
                <h4 class="card-title prayer-card-title fw-bold">${entry.name}</h4>
                ${prayerPointsContent}
            </div>
            <div class="card-footer bg-transparent border-top border-light pt-0">
                <!-- Empty footer for visual separation -->
            </div>
        </div>
    </div>
    `;
}

// Helper function to create a prayer update card
function createUpdateCard(update, isAdmin = false) {
    const date = formatDate(update.created_at);
    
    return `
    <div class="card update-card mb-4">
        <div class="card-header bg-primary text-white">
            <h5 class="card-title mb-0">${update.title}</h5>
        </div>
        <div class="card-body">
            <p class="update-date text-muted">${date}</p>
            <div class="card-text">
                ${update.content}
            </div>
            ${isAdmin ? `
            <div class="text-end mt-3">
                <button class="btn btn-sm btn-primary edit-update me-2" data-id="${update.id}">
                    <i class="bi bi-pencil-square"></i> Edit
                </button>
                <button class="btn btn-sm btn-warning archive-update" data-id="${update.id}">
                    <i class="bi bi-archive"></i> Archive
                </button>
            </div>
            ` : ''}
        </div>
    </div>
    `;
}

// Helper function to create an urgent prayer card
function createUrgentCard(prayer, isAdmin = false) {
    const date = formatDate(prayer.created_at);
    
    return `
    <div class="card urgent-card mb-4">
        <div class="card-header bg-danger text-white">
            <h5 class="card-title mb-0">${prayer.title}</h5>
        </div>
        <div class="card-body">
            <p class="urgent-date text-muted">${date}</p>
            <div class="card-text">
                ${prayer.content}
            </div>
            ${isAdmin ? `
            <div class="text-end mt-3">
                <button class="btn btn-sm btn-primary edit-urgent me-2" data-id="${prayer.id}">
                    <i class="bi bi-pencil-square"></i> Edit
                </button>
                <button class="btn btn-sm btn-warning deactivate-urgent" data-id="${prayer.id}">
                    <i class="bi bi-x-circle"></i> Deactivate
                </button>
            </div>
            ` : ''}
        </div>
    </div>
    `;
}

// Helper function to create a user card
function createUserCard(user, isPending = true) {
    // Always start with placeholder image for faster rendering
    let imageUrl = 'img/placeholder-profile.png';
    
    // Use the pre-generated signed URL if available (for admin view)
    if (user.signed_image_url) {
        imageUrl = user.signed_image_url;
    } else if (user.profile_image_url) {
        // Fallback to the regular URL if we couldn't generate a signed URL
        imageUrl = user.profile_image_url;
    }
    
    // Add styling for the user avatar
    const style = document.createElement('style');
    style.textContent = `
        .user-avatar {
            width: 60px;
            height: 60px;
            object-fit: cover;
            border-radius: 50%;
            border: 2px solid #eee;
        }
    `;
    document.head.appendChild(style);
    
    return `
    <div class="card user-card mb-3">
        <div class="card-body">
            <div class="row align-items-center">
                <div class="col-auto">
                    <img class="user-avatar" src="${imageUrl}" alt="${user.full_name}" 
                         data-user-id="${user.id}"
                         onerror="this.onerror=null; this.src='img/placeholder-profile.png'; console.log('Failed to load image for ${user.full_name}, using placeholder');"
                         crossorigin="anonymous">
                </div>
                <div class="col">
                    <h5 class="card-title mb-1">${user.full_name}</h5>
                    <p class="card-subtitle text-muted">${user.email}</p>
                </div>
                <div class="col-md-auto mt-2 mt-md-0">
                    ${isPending ? `
                    <div>
                        <button class="btn btn-sm btn-success approve-user me-1" data-id="${user.id}" type="button">
                            <i class="bi bi-check"></i> Approve
                        </button>
                        <button class="btn btn-sm btn-danger delete-user" data-id="${user.id}" data-name="${user.full_name}" type="button">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </div>
                    ` : `
                    <div>
                        <button class="btn btn-sm btn-primary edit-user me-1" data-id="${user.id}" type="button">
                            <i class="bi bi-pencil-square"></i> Edit Permissions
                        </button>
                        <button class="btn btn-sm btn-danger delete-user" data-id="${user.id}" data-name="${user.full_name}" type="button">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </div>
                    `}
                </div>
            </div>
        </div>
    </div>
    `;
}

// Show a prayer card in the modal
function showPrayerCardModal(entry) {
    const modal = new bootstrap.Modal(document.getElementById('view-card-modal'));
    const title = document.getElementById('card-modal-title');
    const image = document.getElementById('card-image');
    const content = document.getElementById('card-content');
    
    title.textContent = `Prayer Card: ${entry.name}`;
    image.src = entry.image_url || 'img/placeholder-profile.png';
    
    let contentHtml = `
        <h4 class="fw-bold mb-2">${entry.name}</h4>
        <div class="mb-3">
            <span class="badge bg-primary">Day ${entry.day_of_month}</span>
        </div>
    `;
    
    if (entry.prayer_points) {
        contentHtml += `<div>${entry.prayer_points}</div>`;
    } else {
        contentHtml += `<p>No prayer points provided.</p>`;
    }
    
    content.innerHTML = contentHtml;
    modal.show();
}