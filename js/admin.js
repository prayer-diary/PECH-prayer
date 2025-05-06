// Admin Module

// Global state variable to track approval operations
let isApprovalInProgress = false;

// Make sure loadUsers is globally accessible
window.loadUsers = loadUsers;

// Helper function to simply return the stored URL - no regeneration needed
async function getSignedProfileImageUrl(imagePath) {
    if (!imagePath) return null;
    console.log("Using stored profile image URL directly:", imagePath);
    return imagePath;
}

// Load users for admin view - SIMPLIFIED VERSION
// Avoid multiple calls to loadUsers() at the same time
let loadUsersInProgress = false;

async function loadUsers() {
    // Prevent multiple simultaneous calls
    if (loadUsersInProgress) {
        console.log('loadUsers already in progress, ignoring duplicate call');
        
        // If it's been longer than 10 seconds, force reset and retry
        if (lastLoadUsersStartTime && (Date.now() - lastLoadUsersStartTime > 10000)) {
            console.warn('Previous loadUsers call seems stuck, forcing reset and retrying');
            loadUsersInProgress = false;
            // Continue execution to reload users
        } else {
            return; // Exit if not stuck
        }
    }
    
    loadUsersInProgress = true;
    lastLoadUsersStartTime = Date.now();
    console.log('Starting loadUsers function');
    
    if (!isAdmin()) {
        console.warn('Non-admin user attempted to access admin view');
        showToast('Access Denied', 'You do not have administrator access to manage users.', 'error');
        showView('calendar-view');
        return;
    }
    
    // Get container elements
    const pendingContainer = document.getElementById('pending-users-container');
    const approvedContainer = document.getElementById('approved-users-container');
    
    if (!pendingContainer || !approvedContainer) {
        console.error('User containers not found in DOM');
        showToast('Error', 'UI elements not found. Please refresh the page.', 'error');
        return;
    }
    
    // Show loading indicators
    pendingContainer.innerHTML = createLoadingSpinner();
    approvedContainer.innerHTML = createLoadingSpinner();
    
    try {
        console.log('Checking auth session...');
        // First, check for an active session and get fresh auth state
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.error('No active session found');
            throw new Error('No active session. Please log in again.');
        }
        
        console.log('Fetching user profiles from database...');
        // Use a request ID to bypass potential caching issues
        const requestId = Date.now().toString();
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .not('full_name', 'eq', 'Super Admin') // Exclude Super Admin from the list
            .order('full_name', { ascending: true }); // Removed the limit to show all users
        
        if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
            throw profilesError;
        }
        
        console.log(`Fetched ${profiles ? profiles.length : 0} user profiles`);
        
        // Process the data
        const pendingUsers = profiles.filter(profile => profile.approval_state === 'Pending');
        const approvedUsers = profiles.filter(profile => profile.approval_state === 'Approved');
        
        console.log(`Found ${pendingUsers.length} pending users and ${approvedUsers.length} approved users`);
        
        // No need to regenerate signed URLs - just use the stored URLs directly
        console.log('Using profile image URLs as stored in database');
        for (const user of [...pendingUsers, ...approvedUsers]) {
            if (user.profile_image_url) {
                // Simply assign the stored URL (already a long-expiry signed URL)
                user.signed_image_url = user.profile_image_url;
            }
        }
        
        // Display pending users
        if (pendingUsers.length === 0) {
            pendingContainer.innerHTML = `
                <div class="alert alert-info">
                    No pending users awaiting approval.
                    <button class="btn btn-sm btn-primary float-end" id="refresh-users-button">
                        <i class="bi bi-arrow-clockwise"></i> Refresh
                    </button>
                </div>
            `;
            
            // Add event listener to the refresh button
            setTimeout(() => {
                const refreshButton = document.getElementById('refresh-users-button');
                if (refreshButton) {
                    refreshButton.addEventListener('click', loadUsers);
                }
            }, 0);
            
            // Reset the Approve All button when no pending users exist
            const approveAllBtn = document.getElementById('approve-all-users');
            if (approveAllBtn) {
                approveAllBtn.innerHTML = '<i class="bi bi-check-all me-1"></i>Approve All';
                approveAllBtn.disabled = true; // Disable the button since there's nothing to approve
            }
        } else {
            let pendingHtml = `
                <div class="alert alert-primary mb-3">
                    <strong>${pendingUsers.length}</strong> user${pendingUsers.length !== 1 ? 's' : ''} awaiting approval
                    <button class="btn btn-sm btn-primary float-end" id="refresh-users-button">
                        <i class="bi bi-arrow-clockwise"></i> Refresh
                    </button>
                </div>
            `;
            
            // Add user cards
            for (const user of pendingUsers) {
                pendingHtml += createUserCard(user, true);
            }
            
            pendingContainer.innerHTML = pendingHtml;
            
            // Add event listeners for buttons
            document.querySelectorAll('.approve-user').forEach(button => {
                button.addEventListener('click', async () => {
                    const userId = button.getAttribute('data-id');
                    
                    // Disable approve button and show spinner
                    const originalButtonHtml = button.innerHTML;
                    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                    button.disabled = true;
                    
                    try {
                        await updateUserApproval(userId, 'Approved');
                    } catch (error) {
                        // If error occurred, restore button state
                        button.innerHTML = originalButtonHtml;
                        button.disabled = false;
                    }
                });
            });
            
            document.querySelectorAll('.delete-user').forEach(button => {
                button.addEventListener('click', () => {
                    const userId = button.getAttribute('data-id');
                    const userName = button.getAttribute('data-name');
                    showDeleteUserConfirmation(userId, userName);
                });
            });
            
            // Setup approve all button
            const approveAllBtn = document.getElementById('approve-all-users');
            if (approveAllBtn) {
                // Check if approval operation is already in progress
                if (isApprovalInProgress) {
                    approveAllBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Approving...';
                    approveAllBtn.disabled = true;
                } else {
                    approveAllBtn.innerHTML = '<i class="bi bi-check-all me-1"></i>Approve All';
                    approveAllBtn.disabled = false;
                    
                    // Add click event handler
                    approveAllBtn.onclick = async function() {
                        this.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Approving...';
                        this.disabled = true;
                        await approveAllPendingUsers(pendingUsers);
                    };
                }
            }
        }
        
        // Display approved users
        if (approvedUsers.length === 0) {
            approvedContainer.innerHTML = `
                <div class="alert alert-info">
                    No approved users found.
                </div>
            `;
        } else {
            let approvedHtml = '';
            
            for (const user of approvedUsers) {
                approvedHtml += createUserCard(user, false);
            }
            
            approvedContainer.innerHTML = approvedHtml;
            
            // Add event listeners for buttons
            document.querySelectorAll('.edit-user').forEach(button => {
                button.addEventListener('click', () => {
                    const userId = button.getAttribute('data-id');
                    const user = approvedUsers.find(u => u.id === userId);
                    if (user) {
                        openEditUserModal(user);
                    }
                });
            });
            
            document.querySelectorAll('.delete-user').forEach(button => {
                button.addEventListener('click', () => {
                    const userId = button.getAttribute('data-id');
                    const userName = button.getAttribute('data-name');
                    showDeleteUserConfirmation(userId, userName);
                });
            });
        }
        
    } catch (error) {
        console.error('Error loading users:', error);
        
        // Make sure containers exist before trying to update them
        if (pendingContainer) {
            pendingContainer.innerHTML = `
                <div class="alert alert-danger">
                    Error loading users: ${error.message}
                    <button class="btn btn-sm btn-primary float-end" id="refresh-users-error-button">
                        <i class="bi bi-arrow-clockwise"></i> Refresh
                    </button>
                </div>
            `;
            
            // Add event listener to the refresh button
            setTimeout(() => {
                const refreshButton = document.getElementById('refresh-users-error-button');
                if (refreshButton) {
                    refreshButton.addEventListener('click', loadUsers);
                }
            }, 0);
        }
        
        if (approvedContainer) {
            approvedContainer.innerHTML = `
                <div class="alert alert-danger">
                    Error loading users: ${error.message}
                </div>
            `;
        }
    } finally {
        // Attach event listener to the refresh button if it exists
        setTimeout(() => {
            const refreshButton = document.getElementById('refresh-users-button');
            if (refreshButton) {
                refreshButton.addEventListener('click', loadUsers);
            }
        }, 0);
        
        // Reset the flag to allow future calls
        loadUsersInProgress = false;
        
        // Add a console log for debugging
        console.log('loadUsers function completed, state reset');
    }
}

// Open the edit user modal
function openEditUserModal(user) {
    // Populate form fields
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('user-role').value = user.user_role;
    document.getElementById('approval-state').value = user.approval_state;
    document.getElementById('calendar-editor').checked = user.prayer_calendar_editor;
    document.getElementById('user-update-editor').checked = user.prayer_update_editor;
    document.getElementById('user-urgent-editor').checked = user.urgent_prayer_editor;
    
    // Handle approval admin checkbox
    const approvalAdminField = document.querySelector('.admin-permission-field');
    const approvalAdminCheckbox = document.getElementById('approval-admin');
    
    // Only show approval admin field for administrator role
    if (user.user_role === 'Administrator') {
        approvalAdminField.style.display = 'block';
        approvalAdminCheckbox.checked = user.approval_admin || false;
    } else {
        approvalAdminField.style.display = 'none';
        approvalAdminCheckbox.checked = false;
    }
    
    // Show modal using Bootstrap's modal method
    const modal = new bootstrap.Modal(document.getElementById('edit-user-modal'));
    modal.show();
    
    // Set up save button
    document.getElementById('save-user').onclick = saveUserPermissions;
    
    // Set up role change handler to show/hide admin permissions
    document.getElementById('user-role').addEventListener('change', function() {
        if (this.value === 'Administrator') {
            approvalAdminField.style.display = 'block';
        } else {
            approvalAdminField.style.display = 'none';
            approvalAdminCheckbox.checked = false;
        }
    });
}

// Modification to save user permissions function to add debugging
async function saveUserPermissions() {
    const saveBtn = document.getElementById('save-user');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    try {
        const userId = document.getElementById('edit-user-id').value;
        const userRole = document.getElementById('user-role').value;
        const approvalState = document.getElementById('approval-state').value;
        const calendarEditor = document.getElementById('calendar-editor').checked;
        const updateEditor = document.getElementById('user-update-editor').checked;
        const urgentEditor = document.getElementById('user-urgent-editor').checked;
        
        // Get approval_admin value (only applies to Administrators)
        let approvalAdmin = false;
        if (userRole === 'Administrator') {
            approvalAdmin = document.getElementById('approval-admin').checked;
        }
        
        // Log the values being sent to ensure they're correct
        console.log('Saving user permissions:', {
            userId,
            userRole,
            approvalState,
            calendarEditor,
            updateEditor,
            urgentEditor,
            approvalAdmin
        });
        
        // Update user profile with explicit true/false values
        const { data, error } = await supabase
            .from('profiles')
            .update({
                user_role: userRole,
                approval_state: approvalState,
                prayer_calendar_editor: calendarEditor === true,
                prayer_update_editor: updateEditor === true,
                urgent_prayer_editor: urgentEditor === true,
                approval_admin: approvalAdmin === true
            })
            .eq('id', userId);
            
        if (error) throw error;
        
        // Log the response to see if the update was successful
        console.log('Update response:', data);
        
        // Verify the update by fetching the user profile again
        const { data: updatedProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (fetchError) {
            console.warn('Error verifying update:', fetchError);
        } else {
            console.log('Updated profile values:', {
                prayer_calendar_editor: updatedProfile.prayer_calendar_editor,
                prayer_update_editor: updatedProfile.prayer_update_editor,
                urgent_prayer_editor: updatedProfile.urgent_prayer_editor
            });
        }
        
        // Close modal using Bootstrap's modal method
        const modal = bootstrap.Modal.getInstance(document.getElementById('edit-user-modal'));
        modal.hide();
        
        // Show success notification - no need to reload users as modal is closing
        //showToast('Success', 'User permissions updated successfully.', 'success');
        
        // Instead of calling loadUsers() which causes redundancy,
        // update the UI to reflect changes to the edited user
        updateUserCardInUI(userId, userRole, approvalState);
        
    } catch (error) {
        console.error('Error saving user permissions:', error);
        showToast('Error', `Failed to update user permissions: ${error.message}`, 'error');
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

// Update user approval state
async function updateUserApproval(userId, state) {
    console.log(`Updating user ${userId} to state: ${state}`);
    
    try {
        // Update user profile
        const { data, error } = await supabase
            .from('profiles')
            .update({
                approval_state: state
            })
            .eq('id', userId)
            .select('full_name, email'); // Get the name and email for notification and email_only_users check
            
        if (error) {
            console.error('Error updating user approval:', error);
            throw error;
        }
        
        // If approving, also send welcome email and check for email_only_users entry
        if (state === 'Approved' && data && data.length > 0) {
            // Send approval email
            await sendApprovalEmail(userId);
            
            // Check if user exists in email_only_users table and remove if found
            if (data[0].email) {
                try {
                    // Silently try to remove any matching email_only_users entry
                    const { error: deleteError } = await supabase
                        .from('email_only_users')
                        .delete()
                        .eq('email', data[0].email);
                    
                    if (deleteError) {
                        // Just log the error but don't interrupt the approval flow
                        console.warn('Could not delete email_only_users entry:', deleteError);
                    } else {
                        console.log(`Successfully removed email_only_user entry for ${data[0].email}`);
                    }
                } catch (emailUserError) {
                    // Just log any error but don't interrupt the approval flow
                    console.warn('Error checking email_only_users:', emailUserError);
                }
            }
        }
        
        // Show success notification
        showToast('Success', `User ${state.toLowerCase()} successfully.`, 'success');
        
        // Update the UI directly - move card from pending to approved
        if (state === 'Approved') {
            moveUserCardToApproved(userId, data?.length > 0 ? data[0].full_name : 'User');
        }
    } catch (error) {
        console.error('Error updating user approval:', error);
        showToast('Error', `Failed to update user approval: ${error.message}`, 'error');
        
        // Reset the approval button if it exists
        const approveButton = document.querySelector(`.approve-user[data-id="${userId}"]`);
        if (approveButton) {
            approveButton.innerHTML = '<i class="bi bi-check"></i> Approve';
            approveButton.disabled = false;
        }
    }
}

// Function to move a user card from pending to approved after approval
function moveUserCardToApproved(userId, userName) {
    try {
        // Find the user card in the pending container
        const pendingContainer = document.getElementById('pending-users-container');
        const approvedContainer = document.getElementById('approved-users-container');
        const userCard = document.querySelector(`.approve-user[data-id="${userId}"]`)?.closest('.user-card');
        
        if (!userCard) {
            console.warn(`Could not find user card for ${userId} in the pending container`);
            // Fall back to reloading all users
            loadUsers();
            return;
        }
        
        // Remove from pending container and update UI
        userCard.remove();
        
        // Update the pending users count
        updatePendingUsersCount();
        
        // Create a new approved user card
        // First, get any existing user data from the card
        const userEmail = userCard.querySelector('.card-subtitle')?.textContent || '';
        const userImageSrc = userCard.querySelector('.user-avatar')?.src || 'img/placeholder-profile.png';
        
        // Create the new card with "Edit Permissions" button instead of "Approve"
        const newCardHtml = `
        <div class="card user-card mb-3">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-auto">
                        <img class="user-avatar" src="${userImageSrc}" alt="${userName}" 
                             data-user-id="${userId}"
                             onerror="this.onerror=null; this.src='img/placeholder-profile.png';"
                             crossorigin="anonymous">
                    </div>
                    <div class="col">
                        <h5 class="card-title mb-1">${userName}</h5>
                        <p class="card-subtitle text-muted">${userEmail}</p>
                    </div>
                    <div class="col-md-auto mt-2 mt-md-0">
                        <div>
                            <button class="btn btn-sm btn-primary edit-user me-1" data-id="${userId}" type="button">
                                <i class="bi bi-pencil-square"></i> Edit Permissions
                            </button>
                            <button class="btn btn-sm btn-danger delete-user" data-id="${userId}" data-name="${userName}" type="button">
                                <i class="bi bi-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        
        // Check if "No approved users" message is present and remove it
        const noUsersAlert = approvedContainer.querySelector('.alert');
        if (noUsersAlert) {
            approvedContainer.innerHTML = '';
        }
        
        // Add the card to the approved container
        approvedContainer.insertAdjacentHTML('afterbegin', newCardHtml);
        
        // Add event listeners to the new buttons
        const newEditButton = approvedContainer.querySelector(`.edit-user[data-id="${userId}"]`);
        if (newEditButton) {
            newEditButton.addEventListener('click', () => {
                fetchUserAndOpenEditModal(userId);
            });
        }
        
        const newDeleteButton = approvedContainer.querySelector(`.delete-user[data-id="${userId}"]`);
        if (newDeleteButton) {
            newDeleteButton.addEventListener('click', () => {
                showDeleteUserConfirmation(userId, userName);
            });
        }
        
        console.log(`Successfully moved user ${userId} from pending to approved tab`);
    } catch (error) {
        console.error('Error moving user card to approved container:', error);
        // Fall back to reloading users if there's an error
        loadUsers();
    }
}

// Function to show delete user confirmation modal
function showDeleteUserConfirmation(userId, userName) {
    // Set the user ID and name in the modal
    document.getElementById('delete-user-id').value = userId;
    document.getElementById('delete-user-name').textContent = userName;
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('delete-user-modal'));
    modal.show();
    
    // Set up the confirm delete button handler
    document.getElementById('confirm-delete-user').onclick = async () => {
        await deleteUser(userId);
        modal.hide();
    };
}

// Function to delete a user
async function deleteUser(userId) {
    try {
        const deleteBtn = document.getElementById('confirm-delete-user');
        const originalText = deleteBtn.textContent;
        deleteBtn.textContent = 'Deleting...';
        deleteBtn.disabled = true;
        
        // Get user data for notification and to check for profile image
        const { data: userData, error: userDataError } = await supabase
            .from('profiles')
            .select('full_name, profile_image_url')
            .eq('id', userId)
            .single();
            
        if (userDataError) {
            console.error('Error fetching user data:', userDataError);
            // Continue with deletion even if we can't get the user's data
        }
        
        // Delete the user's profile image from storage if it exists
        if (userData && userData.profile_image_url) {
            try {
                console.log('🗑️ Attempting to delete user profile image');
                
                // Extract the filepath from the URL
                // The URL format is typically like: https://xxx.supabase.co/storage/v1/object/public/prayer-diary/profiles/filename.jpg
                // Or with a signed URL: https://xxx.supabase.co/storage/v1/object/sign/prayer-diary/profiles/filename.jpg?token=xxx
                let oldFilePath = '';
                
                // First check if it's a signed URL (contains 'sign' in the path)
                if (userData.profile_image_url.includes('/sign/')) {
                    // Extract path between '/sign/prayer-diary/' and the query string
                    const pathMatch = userData.profile_image_url.match(/\/sign\/prayer-diary\/([^?]+)/);
                    if (pathMatch && pathMatch[1]) {
                        oldFilePath = pathMatch[1];
                    }
                } else if (userData.profile_image_url.includes('/public/prayer-diary/')) {
                    // Extract path between '/public/prayer-diary/' and the end or query string
                    const pathMatch = userData.profile_image_url.match(/\/public\/prayer-diary\/([^?]+)/);
                    if (pathMatch && pathMatch[1]) {
                        oldFilePath = pathMatch[1];
                    }
                }
                
                // If we found a valid path, delete the file
                if (oldFilePath) {
                    console.log(`🗑️ Deleting user profile image: ${oldFilePath}`);
                    const { error: deleteError } = await supabase.storage
                        .from('prayer-diary')
                        .remove([oldFilePath]);
                        
                    if (deleteError) {
                        console.warn('⚠️ Could not delete user profile image:', deleteError);
                        // Continue with user deletion even if image deletion fails
                    } else {
                        console.log('✅ User profile image deleted successfully');
                    }
                } else {
                    console.warn('⚠️ Could not parse user profile image URL for deletion:', userData.profile_image_url);
                }
            } catch (imageError) {
                console.warn('⚠️ Error deleting user profile image:', imageError);
                // Continue with user deletion even if image deletion fails
            }
        }
        
        // Delete the user from the auth database using Edge Function
        const { error: authError } = await supabase.functions.invoke('admin-delete-user', {
            body: { userId },
            headers: {
                'apikey': SUPABASE_ANON_KEY
            }
        });
        
        if (authError) {
            console.error('Error deleting user from auth database:', authError);
            throw new Error(`Failed to delete user: ${authError.message}`);
        }
        
        // Delete the user profile from the profiles table
        const { error: profileError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);
            
        if (profileError) {
            console.error('Error deleting user profile:', profileError);
            throw new Error(`Failed to delete user profile: ${profileError.message}`);
        }
        
        // Show success notification
        //showToast('Success', `User ${userData ? userData.full_name : ''} has been deleted successfully.`, 'success');
        
        // Remove the user card from the DOM
        try {
            // Find and remove the user card from either container
            const userCard = document.querySelector(`.user-card button[data-id="${userId}"]`);
            if (userCard && userCard.closest('.user-card')) {
                userCard.closest('.user-card').remove();
                console.log(`Removed user card for ${userId} from the DOM`);
                
                // Update container messages if needed (e.g., if no users left)
                updateUserContainerMessages();
            } else {
                console.warn(`Could not find user card for ${userId} in the DOM`);
            }
        } catch (domError) {
            console.error('Error removing user card from DOM:', domError);
            // Force reload users if DOM manipulation fails
            loadUsers();
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Error', `Failed to delete user: ${error.message}`, 'error');
    } finally {
        // Reset the delete button if it exists (modal might be closed)
        const deleteBtn = document.getElementById('confirm-delete-user');
        if (deleteBtn) {
            deleteBtn.textContent = 'Delete User';
            deleteBtn.disabled = false;
        }
    }
}

// Function to approve all pending users
async function approveAllPendingUsers(pendingUsers) {
    if (pendingUsers.length === 0) {
        showToast('Information', 'No pending users to approve.', 'info');
        isApprovalInProgress = false;
        return;
    }
    
    try {
        // Set global state to track operation
        isApprovalInProgress = true;
        
        // Show processing toast
        const toastId = showToast('Processing', `Approving ${pendingUsers.length} users...`, 'info');
        
        let successCount = 0;
        let failCount = 0;
        
        // Make a copy of pending users for UI updates
        const usersToMove = [...pendingUsers]; 
        
        // Process each user sequentially
        for (const user of pendingUsers) {
            try {
                // Update user profile
                const { data, error } = await supabase
                    .from('profiles')
                    .update({
                        approval_state: 'Approved'
                    })
                    .eq('id', user.id)
                    .select('email');
                    
                if (error) throw error;
                
                // Send welcome email
                try {
                    await sendApprovalEmail(user.id);
                } catch (emailError) {
                    console.warn(`Warning: Email failed for ${user.full_name}:`, emailError);
                }
                
                // Check if user exists in email_only_users table and remove if found
                if (data && data.length > 0 && data[0].email) {
                    try {
                        // Silently try to remove any matching email_only_users entry
                        const { error: deleteError } = await supabase
                            .from('email_only_users')
                            .delete()
                            .eq('email', data[0].email);
                        
                        if (!deleteError) {
                            console.log(`Successfully removed email_only_user entry for ${data[0].email}`);
                        }
                    } catch (emailUserError) {
                        // Just log any error but don't interrupt the approval flow
                        console.warn(`Error checking email_only_users for ${user.full_name}:`, emailUserError);
                    }
                }
                
                successCount++;
            } catch (userError) {
                console.error(`Error approving user ${user.full_name}:`, userError);
                failCount++;
            }
        }
        
        // Dismiss processing toast
        dismissToast(toastId);
        
        // Show final results
        if (failCount === 0) {
            showToast('Success', `Successfully approved all ${successCount} users.`, 'success');
        } else {
            showToast('Warning', `Approved ${successCount} users. Failed to approve ${failCount} users.`, 'warning');
        }
        
        // Reset global state flag
        isApprovalInProgress = false;
        
        // Clear pending container and update UI
        if (successCount > 0) {
            // Simplest approach: just reload the users
            // This is more reliable than trying to move multiple cards at once
            loadUsers();
        }
    } catch (error) {
        console.error('Error in bulk approval:', error);
        showToast('Error', `Failed to complete bulk approval: ${error.message}`, 'error');
        
        // Make sure to reset state on error
        isApprovalInProgress = false;
        
        // Reload users to show updated state
        loadUsers();
    }
}

// Function to manually force reset of approve-all button
function resetApprovalButton() {
    isApprovalInProgress = false;
    const approveAllBtn = document.getElementById('approve-all-users');
    if (approveAllBtn) {
        approveAllBtn.innerHTML = '<i class="bi bi-check-all me-1"></i>Approve All';
        approveAllBtn.disabled = false;
    }
    return "Approval button reset. Please refresh the page to see updated state.";
}

// Send approval email to user
async function sendApprovalEmail(userId) {
    try {
        // Get user profile data
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', userId)
            .single();
            
        if (profileError) throw profileError;
        
        const name = profileData.full_name || 'Church Member';
        let email = profileData.email;
        
        if (!email) {
            throw new Error('Unable to retrieve user email');
        }
        
        // This will be implemented in notifications.js
        await sendWelcomeEmail(email, name);
        
    } catch (error) {
        console.error('Error sending approval email:', error);
    }
}

// Update a user card in the UI without reloading all users
function updateUserCardInUI(userId, userRole, approvalState) {
    try {
        // Find the user card in the DOM
        const userCard = document.querySelector(`.user-card [data-id="${userId}"]`).closest('.user-card');
        
        if (!userCard) {
            console.warn('User card not found in the DOM for user ID:', userId);
            return;
        }
        
        // If the approval state changed to 'Approved' and was previously 'Pending',
        // move the card from pending to approved container
        if (approvalState === 'Approved') {
            const pendingContainer = document.getElementById('pending-users-container');
            const approvedContainer = document.getElementById('approved-users-container');
            
            // Check if the card is currently in the pending container
            if (pendingContainer.contains(userCard)) {
                // Remove from pending container
                userCard.remove();
                
                // Update the button in the card to show edit permissions instead of approve
                const btnContainer = userCard.querySelector('.col-md-auto > div');
                if (btnContainer) {
                    btnContainer.innerHTML = `
                        <button class="btn btn-sm btn-primary edit-user me-1" data-id="${userId}" type="button">
                            <i class="bi bi-pencil-square"></i> Edit Permissions
                        </button>
                        <button class="btn btn-sm btn-danger delete-user" data-id="${userId}" data-name="${userCard.querySelector('.card-title').textContent}" type="button">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    `;
                }
                
                // Add to approved container
                if (approvedContainer.querySelector('.alert')) {
                    // Replace the "no users" alert if it exists
                    approvedContainer.innerHTML = '';
                }
                approvedContainer.appendChild(userCard);
                
                // Reattach event listeners
                userCard.querySelector('.edit-user').addEventListener('click', function() {
                    // Fetch the user data and open the edit modal
                    fetchUserAndOpenEditModal(userId);
                });
                
                userCard.querySelector('.delete-user').addEventListener('click', function() {
                    const userName = this.getAttribute('data-name');
                    showDeleteUserConfirmation(userId, userName);
                });
                
                // Update pending users count or message
                updatePendingUsersCount();
            }
        }
        
        // Log the update for debugging
        console.log(`UI updated for user ${userId}: Role=${userRole}, Approval=${approvalState}`);
        
    } catch (error) {
        console.error('Error updating user card in UI:', error);
        // If there's an error updating the UI, fall back to reloading all users
        console.log('Falling back to full user reload due to error');
        loadUsers();
    }
}

// Helper function to fetch user data and open edit modal
async function fetchUserAndOpenEditModal(userId) {
    try {
        const { data: user, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (error) throw error;
        
        openEditUserModal(user);
    } catch (error) {
        console.error('Error fetching user data:', error);
        showToast('Error', `Could not load user data: ${error.message}`, 'error');
    }
}

// Helper to update all user container messages
function updateUserContainerMessages() {
    // Update pending users count
    updatePendingUsersCount();
    
    // Also update approved users container
    const approvedContainer = document.getElementById('approved-users-container');
    const approvedCards = approvedContainer.querySelectorAll('.user-card');
    const approvedCount = approvedCards.length;
    
    // If no approved users left, show a message
    if (approvedCount === 0) {
        approvedContainer.innerHTML = `
            <div class="alert alert-info">
                No approved users found.
                <button class="btn btn-sm btn-primary float-end" onclick="loadUsers()">
                    <i class="bi bi-arrow-clockwise"></i> Refresh
                </button>
            </div>
        `;
    }
}

// Helper to update the pending users count display
function updatePendingUsersCount() {
    const pendingContainer = document.getElementById('pending-users-container');
    if (!pendingContainer) return; // Safety check
    
    const pendingCards = pendingContainer.querySelectorAll('.user-card');
    const count = pendingCards.length;
    
    // Update the pending users count or show "no pending users" message
    if (count === 0) {
        pendingContainer.innerHTML = `
            <div class="alert alert-info">
                No pending users awaiting approval.
                <button class="btn btn-sm btn-primary float-end" onclick="loadUsers()">
                    <i class="bi bi-arrow-clockwise"></i> Refresh
                </button>
            </div>
        `;
        
        // Reset the Approve All button when no pending users exist
        const approveAllBtn = document.getElementById('approve-all-users');
        if (approveAllBtn) {
            approveAllBtn.innerHTML = '<i class="bi bi-check-all me-1"></i>Approve All';
            approveAllBtn.disabled = true; // Disable the button since there's nothing to approve
        }
    } else {
        // Update the count in the alert if it exists
        const alertElement = pendingContainer.querySelector('.alert');
        if (alertElement) {
            alertElement.innerHTML = `
                <strong>${count}</strong> user${count !== 1 ? 's' : ''} awaiting approval
                <button class="btn btn-sm btn-primary float-end" onclick="loadUsers()">
                    <i class="bi bi-arrow-clockwise"></i> Refresh
                </button>
            `;
        }
    }
}

// Safety timeout mechanism to prevent loadUsers from hanging
// Add this to the top of the file after the global variables
document.addEventListener('DOMContentLoaded', function() {
    // Set up a safety mechanism to reset the loadUsersInProgress flag after 30 seconds
    // This prevents the app from completely hanging if there's an error
    setInterval(() => {
        // If loadUsersInProgress has been true for more than 30 seconds, force reset it
        if (loadUsersInProgress && lastLoadUsersStartTime && (Date.now() - lastLoadUsersStartTime > 30000)) {
            console.warn('⚠️ loadUsers has been running for over 30 seconds - forcing reset');
            loadUsersInProgress = false;
            showToast('Warning', 'The user loading process took too long and was reset. Please try again.', 'warning');
        }
    }, 5000); // Check every 5 seconds
});

// Add a timestamp to track when loadUsers starts
let lastLoadUsersStartTime = null;

// Email-only user registration functionality
async function registerEmailOnlyUser() {
    try {
        // Get form values
        const fullName = document.getElementById('email-user-name').value.trim();
        const email = document.getElementById('email-user-email').value.trim();
        
        // Validate inputs
        if (!fullName || !email) {
            showToast('Error', 'Please provide both name and email address', 'error');
            return;
        }
        
        // Check if email field has invalid class (from our validation)
        const emailInput = document.getElementById('email-user-email');
        if (emailInput && emailInput.classList.contains('is-invalid')) {
            // Get the error message from the feedback element
            const feedbackElement = emailInput.nextElementSibling;
            let errorMessage = 'This email address cannot be used';
            
            if (feedbackElement && feedbackElement.classList.contains('invalid-feedback')) {
                errorMessage = feedbackElement.textContent;
            }
            
            showToast('Error', errorMessage, 'error');
            return;
        }
        
        // Show loading state on the button
        const registerBtn = document.getElementById('register-email-user-btn');
        const originalText = registerBtn.textContent;
        registerBtn.textContent = 'Registering...';
        registerBtn.disabled = true;
        
        // Wait for auth stability to ensure we have a valid token
        await window.waitForAuthStability();
        
        // Call the Edge Function to register the email-only user
        const response = await supabase.functions.invoke('register-email-user', {
            body: {
                full_name: fullName,
                email: email
            }
        });
        
        // Destructure the response
        const { data, error } = response;
	  
        // Check if the Edge Function returned an error
        if (data && data.error) {
			throw new Error(data.error);
        }
        
        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('email-user-modal'));
        modal.hide();
        
        // Clear the form
        document.getElementById('email-user-form').reset();
        
        // Show success message
        showToast('Success', `Email-only user '${fullName}' registered successfully`, 'success');
        
        // Reload email users list
        loadEmailOnlyUsers();
        
    } catch (error) {
        console.error('Error registering email-only user:', error.message);
        
        // Check if this is a duplicate email error with already registered user
        if (error.message.includes('already registered as a') || 
            error.message.includes('already registered as an')) {
            // Show the full error message which contains user details
            showToast('Duplicate Email', error.message, 'error');
        } else {
            showToast('Error', `Failed to register email-only user: ${error.message}`, 'error');
        }
    } finally {
        // Reset button state
        const registerBtn = document.getElementById('register-email-user-btn');
        if (registerBtn) {
            registerBtn.textContent = 'Register User';
            registerBtn.disabled = false;
        }
    }
}

// Load email-only users
async function loadEmailOnlyUsers() {
    if (!isAdmin()) return;
    
    const container = document.getElementById('email-users-container');
    if (!container) return;
    
    // Show loading spinner
    container.innerHTML = createLoadingSpinner();
    
    try {
        // Fetch email-only users from the new email_only_users table
        const { data: users, error } = await supabase
            .from('email_only_users')
            .select('id, full_name, email, active')
            .eq('active', true)
            .order('full_name', { ascending: true });
            
        if (error) throw error;
        
        // Display users
        if (!users || users.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    No email-only users found.
                </div>
            `;
            return;
        }
        
        // Generate HTML for user list
        let html = `
            <div class="alert alert-primary mb-3">
                <strong>${users.length}</strong> email-only user${users.length !== 1 ? 's' : ''} registered
            </div>
            <div class="list-group">
        `;
        
        users.forEach(user => {
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-0">${user.full_name}</h6>
                        <small class="text-muted">${user.email}</small>
                    </div>
                    <button class="btn btn-sm btn-danger delete-email-user" data-id="${user.id}" data-name="${user.full_name}">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
        // Add event listeners for delete buttons
        document.querySelectorAll('.delete-email-user').forEach(button => {
            button.addEventListener('click', () => {
                const userId = button.getAttribute('data-id');
                const userName = button.getAttribute('data-name');
                showDeleteEmailUserConfirmation(userId, userName);
            });
        });
        
    } catch (error) {
        console.error('Error loading email-only users:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                Error loading email-only users: ${error.message}
            </div>
        `;
    }
}

// Show delete confirmation for email-only user
function showDeleteEmailUserConfirmation(userId, userName) {
    // Reuse the existing delete user modal
    document.getElementById('delete-user-id').value = userId;
    document.getElementById('delete-user-name').textContent = userName + ' (Email-only User)';
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('delete-user-modal'));
    modal.show();
    
    // Set up the confirm delete button handler
    document.getElementById('confirm-delete-user').onclick = async () => {
        await deleteEmailOnlyUser(userId);
        modal.hide();
    };
}

// Delete an email-only user
async function deleteEmailOnlyUser(userId) {
    try {
        const deleteBtn = document.getElementById('confirm-delete-user');
        const originalText = deleteBtn.textContent;
        deleteBtn.textContent = 'Deleting...';
        deleteBtn.disabled = true;
        
        // Delete the user from the email_only_users table
        const { error: deleteError } = await supabase
            .from('email_only_users')
            .delete()
            .eq('id', userId);
            
        if (deleteError) {
            console.error('Error deleting email-only user:', deleteError);
            throw new Error(`Failed to delete email-only user: ${deleteError.message}`);
        }
        
        // Show success notification
        //showToast('Success', 'Email-only user has been deleted successfully.', 'success');
        
        // Reload email users list
        loadEmailOnlyUsers();
        
    } catch (error) {
        console.error('Error deleting email-only user:', error);
        showToast('Error', `Failed to delete user: ${error.message}`, 'error');
    } finally {
        // Reset the delete button if it exists (modal might be closed)
        const deleteBtn = document.getElementById('confirm-delete-user');
        if (deleteBtn) {
            deleteBtn.textContent = 'Delete User';
            deleteBtn.disabled = false;
        }
    }
}

// Initialize event listeners for email-only user functionality
function initEmailOnlyUserFunctionality() {
    // Register button in the modal
    const registerButton = document.getElementById('register-email-user-btn');
    if (registerButton) {
        registerButton.addEventListener('click', registerEmailOnlyUser);
    }
    
    // Add button in the Email Users tab
    const addEmailUserButton = document.getElementById('add-email-user');
    if (addEmailUserButton) {
        addEmailUserButton.addEventListener('click', () => {
            // Reset the form before showing
            const emailUserForm = document.getElementById('email-user-form');
            if (emailUserForm) {
                emailUserForm.reset();
            }
            
            // Remove any existing validation messages
            const emailInput = document.getElementById('email-user-email');
            if (emailInput) {
                emailInput.classList.remove('is-invalid');
                
                // Remove any existing feedback element
                const existingFeedback = emailInput.nextElementSibling;
                if (existingFeedback && existingFeedback.classList.contains('invalid-feedback')) {
                    existingFeedback.remove();
                }
            }
            
            const modal = new bootstrap.Modal(document.getElementById('email-user-modal'));
            modal.show();
        });
    }
    
    // Navigation menu item
    const navRegisterEmailUser = document.getElementById('nav-register-email-user');
    if (navRegisterEmailUser) {
        navRegisterEmailUser.addEventListener('click', () => {
            // Reset the form before showing
            const emailUserForm = document.getElementById('email-user-form');
            if (emailUserForm) {
                emailUserForm.reset();
            }
            
            // Remove any existing validation messages
            const emailInput = document.getElementById('email-user-email');
            if (emailInput) {
                emailInput.classList.remove('is-invalid');
                
                // Remove any existing feedback element
                const existingFeedback = emailInput.nextElementSibling;
                if (existingFeedback && existingFeedback.classList.contains('invalid-feedback')) {
                    existingFeedback.remove();
                }
            }
            
            const modal = new bootstrap.Modal(document.getElementById('email-user-modal'));
            modal.show();
        });
    }
    
    // Email Users tab click handler to load users
    const emailUsersTab = document.getElementById('email-users-tab');
    if (emailUsersTab) {
        emailUsersTab.addEventListener('click', loadEmailOnlyUsers);
    }
    
    // Initialize email input validation
    const emailInput = document.getElementById('email-user-email');
    if (emailInput) {
        // Add debounce function to avoid too many checks
        let typingTimer;
        const doneTypingInterval = 800; // ms
        
        emailInput.addEventListener('input', function() {
            clearTimeout(typingTimer);
            
            // Clear any existing validation message when typing starts
            this.classList.remove('is-invalid');
            
            // Remove any existing feedback element
            const existingFeedback = this.nextElementSibling;
            if (existingFeedback && existingFeedback.classList.contains('invalid-feedback')) {
                existingFeedback.remove();
            }
            
            // Set a timer to check email after user stops typing
            typingTimer = setTimeout(() => validateEmailInput(this.value), doneTypingInterval);
        });
    }
}

// Validate email input to check if it's already in use
async function validateEmailInput(email) {
    if (!email || email.trim() === '') return;
    
    const emailInput = document.getElementById('email-user-email');
    if (!emailInput) return;
    
    try {
        // Check if the email is a valid format
        const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailPattern.test(email)) {
            // Invalid email format, but we'll let the browser's built-in validation handle this
            return;
        }
        
        // First check for registered users in profiles
        const { data: existingUser, error: userError } = await supabase
            .from('profiles')
            .select('id, full_name, approval_state')
            .eq('email', email)
            .maybeSingle();
            
        if (userError) {
            console.error('Error checking email in profiles:', userError);
            return;
        }
        
        if (existingUser) {
            // Email exists in registered users
            emailInput.classList.add('is-invalid');
            
            // Create feedback message if it doesn't exist
            let feedbackElement = emailInput.nextElementSibling;
            if (!feedbackElement || !feedbackElement.classList.contains('invalid-feedback')) {
                feedbackElement = document.createElement('div');
                feedbackElement.classList.add('invalid-feedback');
                emailInput.parentNode.insertBefore(feedbackElement, emailInput.nextSibling);
            }
            
            const statusText = existingUser.approval_state === 'Approved' ? 'an approved' : 'a ' + existingUser.approval_state.toLowerCase();
            feedbackElement.textContent = `This email is already registered as ${statusText} user: ${existingUser.full_name}`;
            return;
        }
        
        // Then check email-only users
        const { data: existingEmailUser, error: emailUserError } = await supabase
            .from('email_only_users')
            .select('id, full_name')
            .eq('email', email)
            .eq('active', true)
            .maybeSingle();
            
        if (emailUserError) {
            console.error('Error checking email in email_only_users:', emailUserError);
            return;
        }
        
        if (existingEmailUser) {
            // Email exists in email-only users
            emailInput.classList.add('is-invalid');
            
            // Create feedback message if it doesn't exist
            let feedbackElement = emailInput.nextElementSibling;
            if (!feedbackElement || !feedbackElement.classList.contains('invalid-feedback')) {
                feedbackElement = document.createElement('div');
                feedbackElement.classList.add('invalid-feedback');
                emailInput.parentNode.insertBefore(feedbackElement, emailInput.nextSibling);
            }
            
            feedbackElement.textContent = `This email is already registered as an email-only user: ${existingEmailUser.full_name}`;
            return;
        }
        
        // Email is valid and not in use
        emailInput.classList.remove('is-invalid');
        emailInput.classList.add('is-valid');
        
    } catch (error) {
        console.error('Error validating email:', error);
    }
}

// Extend the loadUsers function to also load email-only users
const originalLoadUsers = window.loadUsers;
window.loadUsers = async function() {
    await originalLoadUsers();
    loadEmailOnlyUsers();
};

// Initialize email-only user functionality on DOM load
document.addEventListener('DOMContentLoaded', initEmailOnlyUserFunctionality);

// Make functions globally accessible for use in other modules
window.loadUsers = loadUsers;
window.fetchUserAndOpenEditModal = fetchUserAndOpenEditModal;
window.loadEmailOnlyUsers = loadEmailOnlyUsers;
window.registerEmailOnlyUser = registerEmailOnlyUser;