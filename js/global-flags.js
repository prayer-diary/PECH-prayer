// Global flags utility for preventing duplicate function calls
console.log("Loading global-flags.js");

// Global object to store loading states for different functions
window.loadingFlags = {
    calendar: false,
    updates: false,
    urgent: false,
    profile: false,
    users: false,
    email: false
};

// Log the initial state
console.log("Initial loading flags:", window.loadingFlags);

// Direct handler for hamburger menu toggle
document.addEventListener('DOMContentLoaded', function() {
    console.log("Setting up hamburger menu in global-flags.js");
    setTimeout(function() {
        const hamburgerToggle = document.querySelector('.navbar-drawer-toggle');
        const drawer = document.querySelector('.nav-drawer');
        const overlay = document.querySelector('.nav-overlay');
        
        if (hamburgerToggle && drawer && overlay) {
            console.log("Found hamburger menu elements, setting up direct handlers");
            
            // Attach direct click handler
            hamburgerToggle.addEventListener('click', function() {
                console.log("Hamburger button clicked via global-flags.js");
                drawer.classList.add('open');
                overlay.classList.add('open');
                document.body.style.overflow = 'hidden';
            });
            
            // Also set up close handlers
            const closeBtn = document.querySelector('.drawer-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', function() {
                    console.log("Drawer close button clicked");
                    drawer.classList.remove('open');
                    overlay.classList.remove('open');
                    document.body.style.overflow = '';
                });
            }
            
            if (overlay) {
                overlay.addEventListener('click', function() {
                    console.log("Overlay clicked");
                    drawer.classList.remove('open');
                    overlay.classList.remove('open');
                    document.body.style.overflow = '';
                });
            }
        } else {
            console.error("Hamburger menu elements not found");
        }
    }, 500); // Small delay to ensure DOM is ready
});