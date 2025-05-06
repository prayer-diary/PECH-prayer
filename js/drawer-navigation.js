// Mobile Navigation Drawer Functionality

// Initialize drawer navigation when the DOM is loaded
document.addEventListener('DOMContentLoaded', initDrawerNavigation);

// Also re-initialize when any dropdown contents might have changed
document.addEventListener('navigation-updated', function() {
    console.log("Navigation content updated, reinitializing drawer");
    setTimeout(initDrawerNavigation, 100);
});

function initDrawerNavigation() {
    console.log("Initializing drawer navigation...");
    const drawerToggle = document.querySelector('.navbar-drawer-toggle');
    const drawer = document.querySelector('.nav-drawer');
    const overlay = document.querySelector('.nav-overlay');
    const closeBtn = document.querySelector('.drawer-close');
    const drawerMenu = document.querySelector('.drawer-menu');
    
    // Check if we should actually initialize based on viewport
    const isMobile = window.innerWidth < 992;
    console.log("Current viewport width: " + window.innerWidth + ", is mobile view: " + isMobile);
    
    // Always force redrawing the menu for mobile views
    if (isMobile) {
        console.log("Mobile view detected, forcing menu rebuild");
    }
    
    // Early exit if any required elements are missing
    if (!drawerToggle || !drawer || !overlay || !closeBtn || !drawerMenu) {
        console.error("Drawer navigation elements not found");
        return;
    }
    
    // Clear the drawer menu first
    drawerMenu.innerHTML = '';
    
    // Clone navigation items from navbar to drawer
    const navItems = document.querySelectorAll('#navbarBasic .navbar-nav > li');
    navItems.forEach(item => {
        const clonedItem = item.cloneNode(true);
        
        // Apply the same visibility classes as in the main navbar
        if (item.classList.contains('hidden')) {
            clonedItem.classList.add('hidden');
        }
        
        drawerMenu.appendChild(clonedItem);
    });
    
    // Manual check to ensure 'My Preferences' item exists in the drawer
    // This handles the case where it might not be properly cloned from the navbar
    setTimeout(() => {
        const myDetailsDropdowns = drawerMenu.querySelectorAll('#myDetailsDropdown');
        myDetailsDropdowns.forEach(dropdown => {
            // Check for the dropdown menu containing preferences
            const dropdownMenu = dropdown.nextElementSibling;
            if (dropdownMenu && dropdownMenu.classList.contains('dropdown-menu')) {
                // Check if preferences option exists
                const hasPreferencesItem = Array.from(dropdownMenu.querySelectorAll('.dropdown-item'))
                    .some(item => item.id === 'nav-preferences');
                    
                if (!hasPreferencesItem) {
                    console.log('Adding missing preferences item to drawer menu');
                    // Create preferences item if missing
                    const profileItem = dropdownMenu.querySelector('#nav-profile');
                    if (profileItem) {
                        const preferencesItem = document.createElement('li');
                        preferencesItem.innerHTML = `
                            <a class="dropdown-item" id="nav-preferences" href="#">
                                <i class="bi bi-sliders"></i> My Preferences
                            </a>
                        `;
                        
                        // Insert after profile item
                        profileItem.parentNode.insertBefore(preferencesItem, profileItem.nextSibling);
                        
                        // Add click handler
                        const preferencesLink = preferencesItem.querySelector('#nav-preferences');
                        if (preferencesLink) {
                            preferencesLink.addEventListener('click', function(e) {
                                e.preventDefault();
                                window.closeDrawer ? window.closeDrawer() : console.error('closeDrawer not available');
                                setTimeout(() => {
                                    window.showView('preferences-view');
                                    if (typeof loadUserPreferences === 'function') {
                                        loadUserPreferences();
                                    }
                                }, 300);
                            });
                        }
                    }
                }
            }
        });
    }, 200);
    
    // Also clone the auth container with My Details menu
    const authContainer = document.querySelector('#auth-container');
    if (authContainer) {
        const authClone = authContainer.cloneNode(true);
        // Add a class to style it differently in the drawer
        authClone.classList.add('drawer-auth-container');
        drawerMenu.appendChild(authClone);
    }
    
    // Ensure dropdown-toggle elements in the drawer work correctly
    const dropdownToggles = drawerMenu.querySelectorAll('.dropdown-toggle');
    dropdownToggles.forEach(toggle => {
        // Remove existing event listeners and bootstrap data
        toggle.removeAttribute('data-bs-toggle');
        toggle.removeAttribute('data-bs-target');
        toggle.removeAttribute('aria-expanded');
        
        // Add our custom click handler
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Find the dropdown menu
            const dropdownMenu = this.nextElementSibling;
            if (dropdownMenu && dropdownMenu.classList.contains('dropdown-menu')) {
                // Toggle show class
                dropdownMenu.classList.toggle('show');
                
                // Toggle aria-expanded attribute
                const isExpanded = dropdownMenu.classList.contains('show');
                this.setAttribute('aria-expanded', isExpanded);
            }
        });
    });
    
    // Open drawer
    drawerToggle.addEventListener('click', () => {
        console.log("Opening drawer...");
        drawer.classList.add('open');
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    });
    
    // Close drawer (both with button and overlay)
    function closeDrawer() {
        console.log("Closing drawer...");
        drawer.classList.remove('open');
        overlay.classList.remove('open');
        document.body.style.overflow = ''; // Restore scrolling
    }
    
    // Make closeDrawer accessible in other functions
    window.closeDrawer = closeDrawer;
    
    closeBtn.addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);
    
    // Handle all possible action links in the drawer
    setupDrawerLinks(drawerMenu, closeDrawer);
    
    // Make sure the preferences item exists in the drawer
    setTimeout(() => {
        ensurePreferencesItemExists();
    }, 300);
    
    console.log("Drawer navigation initialized successfully");
}

// Setup link handlers for both regular nav links and dropdown items
// Ensure that preferences nav item exists in the drawer after it's initialized
function ensurePreferencesItemExists() {
    const drawerMenu = document.querySelector('.drawer-menu');
    if (!drawerMenu) return;
    
    // First check if we can find it directly
    const existingItem = drawerMenu.querySelector('#nav-preferences');
    if (existingItem) return; // Already exists, we're good
    
    console.log('Preferences item not found in drawer, adding it manually');
    
    // Find My Details dropdown menu
    const detailsDropdowns = drawerMenu.querySelectorAll('.dropdown-menu');
    detailsDropdowns.forEach(menu => {
        // Look for profile item as a reference point
        const profileItem = menu.querySelector('#nav-profile');
        if (profileItem && profileItem.closest('li')) {
            // Create preferences item
            const prefItem = document.createElement('li');
            prefItem.innerHTML = `
                <a class="dropdown-item" id="nav-preferences" href="#">
                    <i class="bi bi-sliders"></i> My Preferences
                </a>
            `;
            
            // Insert after profile item
            profileItem.closest('li').after(prefItem);
            
            // Add click handler
            const prefLink = prefItem.querySelector('a');
            if (prefLink) {
                prefLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    
                    // Close the drawer if open
                    const drawer = document.querySelector('.nav-drawer');
                    const overlay = document.querySelector('.nav-overlay');
                    if (drawer && drawer.classList.contains('open')) {
                        drawer.classList.remove('open');
                        if (overlay) overlay.classList.remove('open');
                        document.body.style.overflow = '';
                    }
                    
                    // Navigate to preferences view
                    setTimeout(() => {
                        window.showView('preferences-view');
                        if (typeof window.loadUserPreferences === 'function') {
                            window.loadUserPreferences();
                        }
                    }, 300);
                });
            }
        }
    });
}

function setupDrawerLinks(drawerMenu, closeDrawer) {
    // Keep track of navigation actions that might be in progress
    if (!window.navigationInProgress) {
        window.navigationInProgress = false;
    }
    
    // Process all navigation links
    const linkSelectors = [
        // Main nav links
        '#nav-calendar', 
        '#nav-updates', 
        '#nav-urgent',
        // Admin links
        '#nav-manage-users',
        '#nav-register-email-user',
        '#nav-manage-calendar', 
        '#nav-manage-updates',
        '#nav-manage-urgent',
        '#nav-test-email',
        // User menu links
        '#nav-profile',
        '#nav-preferences',
        '#nav-change-password',
        '#btn-logout'
    ];
    
    // Process each link selector
    linkSelectors.forEach(selector => {
        const drawerLinks = drawerMenu.querySelectorAll(selector);
        
        drawerLinks.forEach(link => {
            // Create a fresh event handler for the drawer link
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Check if navigation is already in progress to prevent multiple calls
                if (window.navigationInProgress) {
                    console.log("Navigation already in progress, ignoring click");
                    return;
                }
                
                // Set the flag to prevent duplicate calls
                window.navigationInProgress = true;
                console.log("Navigation started from drawer");
                
                // Get the original id for later use
                const id = this.id;
                
                // Close drawer
                closeDrawer();
                
                // Directly handle the navigation instead of triggering another event
                setTimeout(() => {
                    // Handle based on the ID
                    if (id === 'nav-calendar') {
                        window.showView('calendar-view');
                        if (typeof loadPrayerCalendar === 'function') loadPrayerCalendar();
                    } 
                    else if (id === 'nav-updates') {
                        window.showView('updates-view');
                        if (typeof loadPrayerUpdates === 'function') loadPrayerUpdates();
                    } 
                    else if (id === 'nav-urgent') {
                        window.showView('urgent-view');
                        if (typeof loadUrgentPrayers === 'function') loadUrgentPrayers();
                    } 
                    else if (id === 'nav-profile') {
                        window.showView('profile-view');
                        if (typeof loadUserProfile === 'function') setTimeout(loadUserProfile, 50);
                    }
                    else if (id === 'nav-preferences') {
                        console.log('Navigating to preferences view from drawer');
                        window.showView('preferences-view');
                        if (typeof loadUserPreferences === 'function') {
                            console.log('Loading user preferences...');
                            setTimeout(loadUserPreferences, 50);
                        } else {
                            console.warn('loadUserPreferences function not found');
                        }
                    } 
                    else if (id === 'nav-manage-users') {
                        window.showView('manage-users-view');
                        if (typeof loadUsers === 'function') loadUsers();
                    } 
                    else if (id === 'nav-register-email-user') {
                        // Open the email-only user registration modal
                        console.log('Opening email-only user registration modal from drawer');
                        const emailUserModal = document.getElementById('email-user-modal');
                        if (emailUserModal) {
                            const modal = new bootstrap.Modal(emailUserModal);
                            modal.show();
                        } else {
                            console.error('Email user modal not found in DOM');
                        }
                    }
                    else if (id === 'nav-manage-calendar') {
                        window.showView('manage-calendar-view');
                        if (typeof loadCalendarAdmin === 'function') loadCalendarAdmin();
                    } 
                    else if (id === 'nav-manage-updates') {
                        window.showView('manage-updates-view');
                        if (typeof initUpdateEditor === 'function') initUpdateEditor();
                        if (typeof loadUpdatesAdmin === 'function') loadUpdatesAdmin();
                    } 
                    else if (id === 'nav-manage-urgent') {
                        window.showView('manage-urgent-view');
                        if (typeof initUrgentEditor === 'function') initUrgentEditor();
                        if (typeof loadUrgentAdmin === 'function') loadUrgentAdmin();
                    } 
                    else if (id === 'nav-test-email') {
                        window.showView('test-email-view');
                        if (typeof initEmailTestView === 'function') initEmailTestView();
                    } 
                    else if (id === 'nav-change-password') {
						// Use a longer delay to ensure drawer is fully closed before opening modal
						setTimeout(() => {
							if (typeof openChangePasswordModal === 'function') openChangePasswordModal();
						}, 400); // Longer timeout to avoid animation conflicts
}
                    else if (id === 'btn-logout') {
                        if (typeof logout === 'function') logout();
                    } 
                    else {
                        console.warn(`Unknown navigation id: ${id}`);
                    }
                    
                    // Reset the flag with a small delay to prevent rapid clicks
                    setTimeout(() => {
                        window.navigationInProgress = false;
                        console.log("Navigation completed");
                    }, 500);
                }, 300);
            });
        });
    });
}

// Reinitialize drawer when the window is resized or user logs in
window.addEventListener('resize', function() {
    // Only reinitialize if screen width changes into or out of mobile territory
    const isMobile = window.innerWidth < 992;
    const wasInitialized = document.querySelector('.drawer-menu')?.children?.length > 0;
    
    if (isMobile && !wasInitialized) {
        initDrawerNavigation();
    }
});

// Listen for login/logout to reinitialize drawer with updated auth state
document.addEventListener('login-state-changed', function() {
    console.log("Auth state changed, reinitializing drawer navigation");
    setTimeout(initDrawerNavigation, 500);
});

// Expose showView globally if it was accidentally overwritten
window.showViewFromDrawer = function(viewId) {
    const views = document.querySelectorAll('.view-content');
    views.forEach(view => {
        view.classList.add('d-none');
    });
    
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.remove('d-none');
    }
};

// Make sure drawer navigation is initialized even when DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initDrawerNavigation, 100);
}