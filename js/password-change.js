// Password Change functionality for Prayer Diary

// Initialize password change functionality
document.addEventListener('DOMContentLoaded', initPasswordChange);

// Also initialize after navigation updates
document.addEventListener('navigation-updated', function() {
    console.log('Navigation updated, re-initializing password change functionality');
    setTimeout(setupPasswordChangeHandlers, 200);
});

function initPasswordChange() {
    setupPasswordChangeHandlers();
}

// Separate function to set up password change handlers that can be called multiple times
function setupPasswordChangeHandlers() {
    // Set up event listener for opening the password change modal from main menu
    const changePasswordLink = document.getElementById('nav-change-password');
    if (changePasswordLink) {
        changePasswordLink.addEventListener('click', openPasswordChangeModal);
    }
    
    // Special handling for drawer menu password change links
    const drawerMenu = document.querySelector('.drawer-menu');
    if (drawerMenu) {
        console.log('Setting up drawer menu password change handlers');
        const drawerPasswordLinks = drawerMenu.querySelectorAll('#nav-change-password');
        
        drawerPasswordLinks.forEach(link => {
            // Remove existing listeners to prevent duplicates
            const newLink = link.cloneNode(true);
            link.parentNode.replaceChild(newLink, link);
            
            // Add our special handler
            newLink.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation(); // Prevent event bubbling
                
                console.log('Password change link clicked in drawer');
                
                // Close the drawer first if it's open
                if (typeof window.closeDrawer === 'function') {
                    console.log('Closing drawer before showing password modal');
                    window.closeDrawer();
                }
                
                // Use a longer delay to ensure drawer is fully closed
                setTimeout(function() {
                    console.log('Now opening password change modal');
                    openPasswordChangeModal();
                }, 500);
            });
        });
    }
    
    // Set up form submission handler
    const passwordChangeForm = document.getElementById('change-password-form');
    if (passwordChangeForm) {
        passwordChangeForm.addEventListener('submit', handlePasswordChange);
    }
    
    // Set up password matching validation
    const newPasswordInput = document.getElementById('change-new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const passwordMatchMessage = document.querySelector('.password-match-message');
    
    if (newPasswordInput && confirmPasswordInput) {
        // Validate passwords match when typing
        const validatePasswords = () => {
            if (newPasswordInput.value && confirmPasswordInput.value) {
                if (newPasswordInput.value !== confirmPasswordInput.value) {
                    passwordMatchMessage.classList.remove('d-none');
                    document.getElementById('change-password-submit').disabled = true;
                } else {
                    passwordMatchMessage.classList.add('d-none');
                    document.getElementById('change-password-submit').disabled = false;
                }
            } else {
                passwordMatchMessage.classList.add('d-none');
            }
        };
        
        newPasswordInput.addEventListener('input', validatePasswords);
        confirmPasswordInput.addEventListener('input', validatePasswords);
    }
}

// Open the password change modal
window.openChangePasswordModal = openPasswordChangeModal;
function openPasswordChangeModal() {
    console.log('Opening password change modal...');
    // Reset the form and error messages
    const form = document.getElementById('change-password-form');
    if (form) form.reset();
    
    document.getElementById('password-change-error').classList.add('d-none');
    document.getElementById('password-change-success').classList.add('d-none');
    
    // Enable the submit button
    document.getElementById('change-password-submit').disabled = false;
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('change-password-modal'));
    modal.show();
}

// Handle password change form submission
async function handlePasswordChange(e) {
    e.preventDefault();
    
    // Get form values
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('change-new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Basic validation
    if (newPassword !== confirmPassword) {
        showPasswordChangeError('New passwords do not match.');
        return;
    }
    
    if (newPassword.length < 6) {
        showPasswordChangeError('New password must be at least 6 characters long.');
        return;
    }
    
    // Show loading state
    const submitBtn = document.getElementById('change-password-submit');
    const originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Updating...';
    submitBtn.disabled = true;
    
    try {
        // First validate the current password by attempting to sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: currentUser.email,
            password: currentPassword
        });
        
        if (signInError) {
            throw new Error('Current password is incorrect.');
        }
        
        // Update password
        const { error: updateError } = await supabase.auth.updateUser({
            password: newPassword
        });
        
        if (updateError) throw updateError;
        
        // Show success message
        document.getElementById('change-password-form').classList.add('d-none');
        document.getElementById('password-change-success').classList.remove('d-none');
        document.getElementById('password-change-success').querySelector('p').textContent = 
            'Your password has been updated successfully!';
        
        // Close modal after 3 seconds
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('change-password-modal'));
            if (modal) modal.hide();
            
            // Reset the form for next time
            document.getElementById('change-password-form').reset();
            document.getElementById('change-password-form').classList.remove('d-none');
        }, 3000);
        
    } catch (error) {
        console.error('Error changing password:', error);
        showPasswordChangeError(error.message || 'Failed to update password. Please try again.');
        
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Show error message in the password change modal
function showPasswordChangeError(message) {
    const errorElement = document.getElementById('password-change-error');
    errorElement.querySelector('p').textContent = message;
    errorElement.classList.remove('d-none');
}
