// Refresh functionality for the Prayer Diary app
// This handles the refresh button in the nav bar and session refreshing

// Function to handle session refresh
function refreshApplication() {
    // Start spinner animation
    const refreshButton = document.getElementById('refresh-button');
    const originalContent = refreshButton.innerHTML;
    refreshButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
    refreshButton.disabled = true;
    
    // Show notification
    showNotification('Refreshing', 'Updating application data...', 'info');
    
    // Save current view to restore after refresh
    const currentView = document.querySelector('.view-content:not(.d-none)')?.id || '';
    if (currentView) {
        sessionStorage.setItem('lastView', currentView);
    }
    
    // Save scroll position
    sessionStorage.setItem('scrollPosition', window.scrollY.toString());
    
    // Set a flag to indicate a manual refresh
    sessionStorage.setItem('manualRefresh', 'true');
    
    // Refresh the page after a short delay
    setTimeout(() => {
        window.location.reload();
    }, 800);
}

// Set up refresh button
document.addEventListener('DOMContentLoaded', function() {
    // Add CSS for the refresh button dynamically
    const style = document.createElement('style');
    style.textContent = `
        #refresh-button {
            border-radius: 50%;
            width: 32px;
            height: 32px;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: rgba(255, 255, 255, 0.2);
            border: none;
            margin-right: 10px;
            transition: transform 0.3s ease-in-out;
        }
        
        #refresh-button:hover {
            background-color: rgba(255, 255, 255, 0.3);
            transform: rotate(30deg);
        }
        
        #refresh-button:active {
            transform: rotate(360deg);
        }
        
        #refresh-button .spinner-border {
            width: 1rem;
            height: 1rem;
        }
        
        @media (max-width: 576px) {
            #refresh-button {
                width: 28px;
                height: 28px;
            }
        }
    `;
    document.head.appendChild(style);

    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
        refreshButton.addEventListener('click', refreshApplication);
    }
    
    // Check if we're coming back from a refresh and restore state
    if (sessionStorage.getItem('manualRefresh') === 'true') {
        sessionStorage.removeItem('manualRefresh');
        
        // Restore the previous view if saved
        const lastView = sessionStorage.getItem('lastView');
        if (lastView) {
            setTimeout(() => {
                showView(lastView);
                sessionStorage.removeItem('lastView');
                
                // Restore scroll position
                const scrollPosition = parseInt(sessionStorage.getItem('scrollPosition') || '0');
                if (!isNaN(scrollPosition)) {
                    window.scrollTo(0, scrollPosition);
                    sessionStorage.removeItem('scrollPosition');
                }
                
                // Show a success message
                showNotification('Refreshed', 'Application data has been updated', 'success');
            }, 300);
        }
    }
    
    // Handle topic-specific state restoration
    if (sessionStorage.getItem('topicSaved') === 'true') {
        sessionStorage.removeItem('topicSaved');
        
        // Navigate back to the manage calendar view if needed
        setTimeout(() => {
            const lastView = sessionStorage.getItem('lastView');
            if (lastView && lastView === 'manage-calendar-view') {
                showView(lastView);
                // Also reopen the topic management modal
                setTimeout(() => {
                    if (typeof openTopicManagement === 'function') {
                        openTopicManagement();
                    }
                }, 500);
            }
        }, 300);
    }
    
    if (sessionStorage.getItem('topicDeleted') === 'true' || 
        sessionStorage.getItem('topicAssigned') === 'true' ||
        sessionStorage.getItem('topicMonthsUpdated') === 'true') {
        // Clear flags
        sessionStorage.removeItem('topicDeleted');
        sessionStorage.removeItem('topicAssigned');
        sessionStorage.removeItem('topicMonthsUpdated');
        
        // Navigate back to the appropriate view
        setTimeout(() => {
            const lastView = sessionStorage.getItem('lastView');
            if (lastView) {
                showView(lastView);
                sessionStorage.removeItem('lastView');
            }
        }, 300);
    }
});