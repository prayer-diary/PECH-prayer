// Prayer Updates Module - Fixed version with loading flags

// Global variables for editors
let updateEditor;
let editUpdateEditor;
let initUpdateEditorFlag = false;
let selectedUpdateId = null; // Track selected update

// Loading flags to prevent duplicate calls
let isLoadingUpdatesAdmin = false;
let isCheckingDateExists = false;

// Function to clean up content colors to avoid dark mode issues
function cleanupContentColors(htmlContent) {
    if (!htmlContent) return '';
  
    // Create a temporary DOM element to process the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
  
    // Remove all inline color styles
    const elementsWithStyle = tempDiv.querySelectorAll('[style*="color"]');
    elementsWithStyle.forEach(el => {
        // Remove only color-related styles but keep other styles
        const style = el.getAttribute('style');
        if (style) {
            const newStyle = style.replace(/color\s*:\s*[^;]+;?/gi, '');
            if (newStyle.trim()) {
                el.setAttribute('style', newStyle);
            } else {
                el.removeAttribute('style');
            }
        }
    });
  
    // Also handle span elements with color attribute
    const elementsWithColorAttr = tempDiv.querySelectorAll('[color]');
    elementsWithColorAttr.forEach(el => {
        el.removeAttribute('color');
    });
  
    return tempDiv.innerHTML;
}

// Initialize the Rich Text Editor for updates
function initUpdateEditor() {
    console.log('DEBUG: initUpdateEditor - Start initialization');
    if (initUpdateEditorFlag) {
        console.log('DEBUG: initUpdateEditor - Duplicate call detected, aborting');
        return;
    }
    
    // Define custom formats that exclude direct color styling
    const allowedFormats = [
        'bold', 'italic', 'underline', 'strike', 
        'header', 'list', 'indent', 
        'link', 'image', 'direction', 'align', 'blockquote'
        // Notice we're NOT including 'color' in the allowed formats
    ];
        
    // Initialize update editor if not already initialized
    if (!updateEditor) {
        console.log('DEBUG: initUpdateEditor - Creating main update editor');
        updateEditor = new Quill('#update-editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'align': [] }],
                    ['link', 'image'],
                    ['clean']
                ]
            },
            formats: allowedFormats
        });
        
        // Add editor change handler to update button states
        console.log('DEBUG: initUpdateEditor - Setting up text-change event handler');
        updateEditor.on('text-change', function() {
            console.log('DEBUG: Quill text-change event triggered');
            updateButtonStates();
        });
    }
    
    // Initialize edit update editor if not already initialized
    if (!editUpdateEditor) {
        console.log('DEBUG: initUpdateEditor - Creating edit update editor');
        editUpdateEditor = new Quill('#edit-update-editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'align': [] }],
                    ['link'],
                    ['clean']
                ]
            },
            formats: allowedFormats,
            placeholder: 'Edit prayer update...',
        });
    }
    
    // Set today's date in the date field
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    const dateField = document.getElementById('update-date');
    console.log('DEBUG: initUpdateEditor - Setting default date:', formattedDate);
    if (dateField) {
        dateField.value = formattedDate;
    } else {
        console.error('DEBUG: initUpdateEditor - Date field not found in DOM');
    }
    
    // Set default title with prefix
    const titleField = document.getElementById('update-title');
    console.log('DEBUG: initUpdateEditor - Setting default title');
    if (titleField) {
        titleField.value = 'PECH Prayer Update';
    } else {
        console.error('DEBUG: initUpdateEditor - Title field not found in DOM');
    }
    
    // Set up direct click handlers for buttons
    console.log('DEBUG: initUpdateEditor - Setting up button handlers');
    const saveAndSendBtn = document.getElementById('save-and-send-btn');
    const saveOnlyBtn = document.getElementById('save-only-btn');
    const clearBtn = document.getElementById('clear-btn');
    const editBtn = document.getElementById('edit-update-btn');
    const deleteBtn = document.getElementById('delete-update-btn');
    
    if (saveAndSendBtn) {
        console.log('DEBUG: initUpdateEditor - Found save-and-send-btn, adding click handler');
        saveAndSendBtn.addEventListener('click', function(e) {
            console.log('DEBUG: saveAndSendBtn click event triggered');
            e.preventDefault();
            createPrayerUpdate('saveAndSend', this);
        });
    } else {
        console.error('DEBUG: initUpdateEditor - Save and send button not found in DOM');
    }
    
    if (saveOnlyBtn) {
        console.log('DEBUG: initUpdateEditor - Found save-only-btn, adding click handler');
        saveOnlyBtn.addEventListener('click', function(e) {
            console.log('DEBUG: saveOnlyBtn click event triggered');
            e.preventDefault();
            createPrayerUpdate('saveOnly', this);
        });
    } else {
        console.error('DEBUG: initUpdateEditor - Save only button not found in DOM');
    }
    
    if (clearBtn) {
        console.log('DEBUG: initUpdateEditor - Found clear-btn, adding click handler');
        clearBtn.addEventListener('click', function(e) {
            console.log('DEBUG: clearBtn click event triggered');
            e.preventDefault();
            clearEditor();
        });
    } else {
        console.error('DEBUG: initUpdateEditor - Clear button not found in DOM');
    }
    
    if (editBtn) {
        console.log('DEBUG: initUpdateEditor - Found edit-update-btn, adding click handler');
        editBtn.addEventListener('click', function(e) {
            console.log('DEBUG: editBtn click event triggered');
            e.preventDefault();
            if (selectedUpdateId) {
                console.log('DEBUG: editBtn - selectedUpdateId exists:', selectedUpdateId);
                const selectedUpdate = getSelectedUpdate();
                if (selectedUpdate) {
                    console.log('DEBUG: editBtn - Found selected update:', selectedUpdate);
                    loadUpdateIntoEditor(selectedUpdate);
                } else {
                    console.error('DEBUG: editBtn - Could not find selected update object');
                }
            } else {
                console.log('DEBUG: editBtn - No update selected');
            }
        });
    } else {
        console.error('DEBUG: initUpdateEditor - Edit update button not found in DOM');
    }
    
    if (deleteBtn) {
        console.log('DEBUG: initUpdateEditor - Found delete-update-btn, adding click handler');
        deleteBtn.addEventListener('click', function(e) {
            console.log('DEBUG: deleteBtn click event triggered');
            e.preventDefault();
            if (selectedUpdateId) {
                console.log('DEBUG: deleteBtn - Calling deleteUpdate with id:', selectedUpdateId);
                deleteUpdate(selectedUpdateId);
            } else {
                console.log('DEBUG: deleteBtn - No update selected');
            }
        });
    } else {
        console.error('DEBUG: initUpdateEditor - Delete update button not found in DOM');
    }
    
    // Initial button state update
    console.log('DEBUG: initUpdateEditor - Initial button state update');
    updateButtonStates();
    
    initUpdateEditorFlag = true;
    console.log('DEBUG: initUpdateEditor - Initialization complete');
}

// Clear the editor with confirmation
function clearEditor() {
    console.log('DEBUG: clearEditor - Starting clear operation');
    
    // Reset form directly without confirmation
    console.log('DEBUG: clearEditor - Resetting form');
    document.getElementById('update-form').reset();
    
    console.log('DEBUG: clearEditor - Clearing Quill editor');
    updateEditor.setContents([]);
    
    // Set today's date in the date field
    console.log('DEBUG: clearEditor - Setting default date');
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    document.getElementById('update-date').value = formattedDate;
    
    // Reset default title
    console.log('DEBUG: clearEditor - Setting default title');
    document.getElementById('update-title').value = 'PECH Prayer Update';
    
    // Reset selection
    console.log('DEBUG: clearEditor - Resetting selection state');
    selectedUpdateId = null;
    updateButtonStates();
    
    // Clear selection highlight in the updates list
    console.log('DEBUG: clearEditor - Clearing selection highlight');
    const allRows = document.querySelectorAll('.update-list-item');
    allRows.forEach(row => row.classList.remove('selected'));
    
    console.log('DEBUG: clearEditor - Clear operation complete');
}

// Update button states based on current content and selection
function updateButtonStates() {
    console.log('DEBUG: updateButtonStates - Updating button states');
    const saveAndSendBtn = document.getElementById('save-and-send-btn');
    const saveOnlyBtn = document.getElementById('save-only-btn');
    const editBtn = document.getElementById('edit-update-btn');
    const deleteBtn = document.getElementById('delete-update-btn');
    
    // Get current editor content
    let editorContent = '';
    if (updateEditor && updateEditor.root) {
        editorContent = updateEditor.root.innerHTML;
        console.log('DEBUG: updateButtonStates - Current editor content length:', editorContent.length);
    } else {
        console.error('DEBUG: updateButtonStates - updateEditor or root element is not available');
    }
    
    const isEmpty = !editorContent || editorContent === '<p><br></p>';
    console.log('DEBUG: updateButtonStates - Editor is empty:', isEmpty);
    
    let titleContent = '';
    const titleElement = document.getElementById('update-title');
    if (titleElement) {
        titleContent = titleElement.value.trim();
        console.log('DEBUG: updateButtonStates - Title content:', titleContent);
    } else {
        console.error('DEBUG: updateButtonStates - Title element not found');
    }
    
    // Update Save buttons - enabled if both title and content exist
    if (saveAndSendBtn) {
        saveAndSendBtn.disabled = isEmpty || !titleContent;
        console.log('DEBUG: updateButtonStates - saveAndSendBtn disabled:', saveAndSendBtn.disabled);
    } else {
        console.log('DEBUG: updateButtonStates - saveAndSendBtn not found');
    }
    
    if (saveOnlyBtn) {
        saveOnlyBtn.disabled = isEmpty || !titleContent;
        console.log('DEBUG: updateButtonStates - saveOnlyBtn disabled:', saveOnlyBtn.disabled);
    } else {
        console.log('DEBUG: updateButtonStates - saveOnlyBtn not found');
    }
    
    // Update Edit button - enabled if editor is empty and an update is selected
    if (editBtn) {
        editBtn.disabled = !isEmpty || !selectedUpdateId;
        console.log('DEBUG: updateButtonStates - editBtn disabled:', editBtn.disabled);
    } else {
        console.log('DEBUG: updateButtonStates - editBtn not found');
    }
    
    // Update Delete button - enabled if an update is selected
    if (deleteBtn) {
        deleteBtn.disabled = !selectedUpdateId;
        console.log('DEBUG: updateButtonStates - deleteBtn disabled:', deleteBtn.disabled);
    } else {
        console.log('DEBUG: updateButtonStates - deleteBtn not found');
    }
    
    console.log('DEBUG: updateButtonStates - Button states updated');
}

// Get the currently selected update object
function getSelectedUpdate() {
    console.log('DEBUG: getSelectedUpdate - Getting selected update with ID:', selectedUpdateId);
    // This will be defined by the loadUpdatesAdmin function
    const allUpdatesData = window.allPrayerUpdates || [];
    console.log('DEBUG: getSelectedUpdate - Total updates in memory:', allUpdatesData.length);
    const update = allUpdatesData.find(update => update.id === selectedUpdateId);
    console.log('DEBUG: getSelectedUpdate - Found update:', update ? 'yes' : 'no');
    return update;
}

// Global variable to track selected update in the 'Previous' tab
let selectedPreviousUpdateId = null;

// Load all prayer updates (both current and archived)
async function loadPrayerUpdates() {
    console.log('DEBUG: loadPrayerUpdates - Starting to load updates for user view');
    if (!isApproved()) {
        console.log('DEBUG: loadPrayerUpdates - User not approved, aborting');
        return;
    }
	
	 await window.waitForAuthStability();
    
    // Get container elements
    const latestContainer = document.getElementById('updates-container');
    const previousContainer = document.getElementById('archived-updates-container');
    
    // Show loading indicators
    console.log('DEBUG: loadPrayerUpdates - Showing loading spinners');
    latestContainer.innerHTML = createLoadingSpinner();
    previousContainer.innerHTML = createLoadingSpinner();
    
    try {
        // Load all updates
        console.log('DEBUG: loadPrayerUpdates - Executing Supabase query');
        const { data: updates, error } = await supabase
            .from('prayer_updates')
            .select('*')
            .order('update_date', { ascending: false });
            
        console.log('DEBUG: loadPrayerUpdates - Query complete');
        
        if (error) {
            console.error('DEBUG: loadPrayerUpdates - Supabase error:', error);
            throw error;
        }
        
        console.log('DEBUG: loadPrayerUpdates - Retrieved updates count:', updates ? updates.length : 0);
        
        // Store updates for later reference
        window.allPrayerUpdates = updates || [];
        
        // Display latest update
        if (updates.length === 0) {
            console.log('DEBUG: loadPrayerUpdates - No updates to display');
            latestContainer.innerHTML = `
                <div class="alert alert-info">
                    No prayer updates available.
                </div>
            `;
            previousContainer.innerHTML = `
                <div class="alert alert-info">
                    No previous updates available.
                </div>
            `;
        } else {
            // Display the latest update in the 'Latest' tab
            const latestUpdate = updates[0]; // First item is most recent due to descending order
            let latestHtml = createUpdateCard(latestUpdate);
            latestContainer.innerHTML = latestHtml;
            console.log('DEBUG: loadPrayerUpdates - Latest update displayed');
            
            // Display previous updates as a list in the 'Previous' tab with minimal info
            if (updates.length > 1) {
                let previousHtml = '<div class="list-group">';
                // Start from index 1 to skip the latest update
                for (let i = 1; i < updates.length; i++) {
                    previousHtml += createPreviousUpdateListItem(updates[i]);
                }
                previousHtml += '</div>';
                previousContainer.innerHTML = previousHtml;
                
                // Add event listeners to previous update items
                previousContainer.querySelectorAll('.previous-update-item').forEach(item => {
                    // Single click to select
                    item.addEventListener('click', function() {
                        selectPreviousUpdate(this);
                    });
                    
                    // Double click to view
                    item.addEventListener('dblclick', function() {
                        const updateId = this.dataset.id;
                        viewUpdateDetails(updateId);
                    });
                });
                
                // Setup open selected update button
                const openSelectedBtn = document.getElementById('open-selected-update');
                if (openSelectedBtn) {
                    openSelectedBtn.addEventListener('click', function() {
                        if (selectedPreviousUpdateId) {
                            viewUpdateDetails(selectedPreviousUpdateId);
                        }
                    });
                }
                
                console.log('DEBUG: loadPrayerUpdates - Previous updates displayed');
            } else {
                // No previous updates
                previousContainer.innerHTML = `
                    <div class="alert alert-info">
                        No previous updates available.
                    </div>
                `;
            }
        }
        
    } catch (error) {
        console.error('DEBUG: loadPrayerUpdates - Error loading prayer updates:', error);
        latestContainer.innerHTML = `
            <div class="alert alert-danger">
                Error loading prayer updates: ${error.message}
            </div>
        `;
        previousContainer.innerHTML = `
            <div class="alert alert-danger">
                Error loading prayer updates: ${error.message}
            </div>
        `;
    }
    
    console.log('DEBUG: loadPrayerUpdates - Function complete');
}

// Function to select a previous update
function selectPreviousUpdate(element) {
    // Remove selected class from all items
    document.querySelectorAll('.previous-update-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add selected class to clicked item
    element.classList.add('selected');
    
    // Update the selected ID
    selectedPreviousUpdateId = element.dataset.id;
    
    // Enable the open button
    const openButton = document.getElementById('open-selected-update');
    if (openButton) {
        openButton.disabled = false;
    }
}

// Function to create a list item for a previous update
function createPreviousUpdateListItem(update) {
    // Format the date
    const date = update.update_date ? new Date(update.update_date) : new Date(update.created_at);
    const formattedDate = date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    
    return `
    <div class="list-group-item d-flex justify-content-between align-items-center previous-update-item" data-id="${update.id}">
        <div>
            <h6 class="mb-0">${update.title}</h6>
            <small class="text-muted"><i class="bi bi-calendar"></i> ${formattedDate}</small>
        </div>
    </div>
    `;
}

// Function to view update details in a modal
async function viewUpdateDetails(updateId) {
    const updates = window.allPrayerUpdates || [];
    const update = updates.find(u => u.id === updateId);
    
    if (!update) {
        console.error('DEBUG: viewUpdateDetails - Update not found with ID:', updateId);
        showNotification('Error', 'Update not found', 'error');
        return;
    }
    
    // Format the date
    const date = update.update_date ? new Date(update.update_date) : new Date(update.created_at);
    const formattedDate = date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    
    // Clean up the content and wrap it in content-container for theme awareness
    const cleanContent = cleanupContentColors(update.content);
    const processedContent = `<div class="content-container">${cleanContent}</div>`;
    
    // Set modal content
    document.getElementById('view-update-title').textContent = update.title;
    document.getElementById('view-update-date').querySelector('span').textContent = formattedDate;
    document.getElementById('view-update-content').innerHTML = processedContent;
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('view-update-modal'));
    modal.show();
}

// Load updates for admin view - MODIFIED with loading flag
async function loadUpdatesAdmin() {
    console.log('DEBUG: loadUpdatesAdmin - Starting to load updates for admin view');
    
    // Check if already loading to prevent duplicate calls
    if (isLoadingUpdatesAdmin) {
        console.log('DEBUG: loadUpdatesAdmin - Already loading, aborting duplicate call');
        return;
    }
	
	// NEW: Wait for auth stability before proceeding
    await window.waitForAuthStability();
    
    // Set loading flag
    isLoadingUpdatesAdmin = true;
    
    if (!hasPermission('prayer_update_editor')) {
        console.error('DEBUG: loadUpdatesAdmin - User lacks permission, aborting');
        isLoadingUpdatesAdmin = false; // Reset flag
        return;
    }
    
    // Get container element for all updates
    const container = document.getElementById('admin-updates-container');
    if (!container) {
        console.error('DEBUG: loadUpdatesAdmin - Container not found in DOM');
        isLoadingUpdatesAdmin = false; // Reset flag
        return;
    }
    
    // Show loading indicator
    console.log('DEBUG: loadUpdatesAdmin - Showing loading spinner');
    container.innerHTML = createLoadingSpinner();
    
    try {
        // Load all updates ordered by date (most recent first)
        console.log('DEBUG: loadUpdatesAdmin - Executing Supabase query');
        const { data: updates, error } = await supabase
            .from('prayer_updates')
            .select('*')
            .order('update_date', { ascending: false });
            
        console.log('DEBUG: loadUpdatesAdmin - Query complete');
        
        if (error) {
            console.error('DEBUG: loadUpdatesAdmin - Supabase error:', error);
            throw error;
        }
        
        console.log('DEBUG: loadUpdatesAdmin - Retrieved updates count:', updates ? updates.length : 0);
        
        // Store the updates data for later reference
        console.log('DEBUG: loadUpdatesAdmin - Storing updates in window.allPrayerUpdates');
        window.allPrayerUpdates = updates;
        
        // Display updates
        if (updates.length === 0) {
            console.log('DEBUG: loadUpdatesAdmin - No updates to display');
            container.innerHTML = `
                <div class="alert alert-info">
                    No prayer updates available. Create one using the form.
                </div>
            `;
        } else {
            // Create a list to hold the update items
            console.log('DEBUG: loadUpdatesAdmin - Building HTML for updates');
            let html = '<div class="list-group">';
            updates.forEach(update => {
                html += createUpdateListItem(update);
            });
            html += '</div>';
            container.innerHTML = html;
            console.log('DEBUG: loadUpdatesAdmin - Updates displayed');
            
            // Add selection event listeners
            console.log('DEBUG: loadUpdatesAdmin - Adding event listeners to list items');
            container.querySelectorAll('.update-list-item').forEach(item => {
                // Single click to select
                item.addEventListener('click', (e) => {
                    console.log('DEBUG: update-list-item click event triggered');
                    const updateId = item.getAttribute('data-id');
                    console.log('DEBUG: update-list-item - Update ID clicked:', updateId);
                    
                    // Remove selected class from all items
                    container.querySelectorAll('.update-list-item').forEach(row => {
                        row.classList.remove('selected');
                    });
                    
                    // Add selected class to clicked item
                    item.classList.add('selected');
                    
                    // Update selected ID
                    selectedUpdateId = updateId;
                    console.log('DEBUG: update-list-item - selectedUpdateId set to:', selectedUpdateId);
                    
                    // Update button states
                    updateButtonStates();
                });
                
                // Double click to edit
                item.addEventListener('dblclick', (e) => {
                    console.log('DEBUG: update-list-item dblclick event triggered');
                    const updateId = item.getAttribute('data-id');
                    console.log('DEBUG: update-list-item - Update ID double-clicked:', updateId);
                    const update = updates.find(u => u.id === updateId);
                    
                    // Check if editor is empty before loading
                    const editorContent = updateEditor.root.innerHTML;
                    const isEmpty = !editorContent || editorContent === '<p><br></p>';
                    console.log('DEBUG: update-list-item - Editor is empty:', isEmpty);
                    
                    if (isEmpty && update) {
                        console.log('DEBUG: update-list-item - Loading update into editor');
                        loadUpdateIntoEditor(update);
                    } else if (!isEmpty) {
                        console.log('DEBUG: update-list-item - Editor not empty, showing warning');
                        showNotification('Warning', 'Please clear the editor before editing an existing update.', 'warning');
                    }
                });
            });
        }
        
    } catch (error) {
        console.error('DEBUG: loadUpdatesAdmin - Error loading admin prayer updates:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                Error loading prayer updates: ${error.message}
            </div>
        `;
    } finally {
        // Reset loading flag when done, regardless of success/failure
        isLoadingUpdatesAdmin = false;
        console.log('DEBUG: loadUpdatesAdmin - Reset loading flag');
    }
    
    console.log('DEBUG: loadUpdatesAdmin - Function complete');
}

// Create a list item for an update in the admin view
function createUpdateListItem(update) {
    console.log('DEBUG: createUpdateListItem - Creating item for update ID:', update.id);
    // Format the date
    const date = update.update_date ? new Date(update.update_date) : new Date(update.created_at);
    const formattedDate = date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    
    let listItemHtml = `
    <div class="list-group-item d-flex justify-content-between align-items-center update-list-item" data-id="${update.id}">
        <div>
            <h6 class="mb-0">${update.title}</h6>
            <small class="text-muted"><i class="bi bi-calendar"></i> ${formattedDate}</small>
        </div>
        <div>
            ${update.is_archived ? 
                '<span class="badge bg-secondary">Archived</span>' : 
                ''}
        </div>
    </div>
    `;
    
    return listItemHtml;
}

// Load an update into the main editor
function loadUpdateIntoEditor(update) {
    console.log('DEBUG: loadUpdateIntoEditor - Loading update into editor, ID:', update.id);
    
    // Set the title (full title including prefix)
    console.log('DEBUG: loadUpdateIntoEditor - Setting title:', update.title);
    document.getElementById('update-title').value = update.title;
    
    // Set the date if available
    if (update.update_date) {
        console.log('DEBUG: loadUpdateIntoEditor - Setting date:', update.update_date);
        document.getElementById('update-date').value = update.update_date;
    } else {
        console.log('DEBUG: loadUpdateIntoEditor - No update_date available');
    }
    
    // Set content in main Quill editor
    console.log('DEBUG: loadUpdateIntoEditor - Setting content in Quill editor');
    updateEditor.root.innerHTML = update.content;
    
    // Set the selected ID to prevent re-editing
    selectedUpdateId = update.id;
    console.log('DEBUG: loadUpdateIntoEditor - Set selectedUpdateId to:', selectedUpdateId);
    
    // Update button states
    console.log('DEBUG: loadUpdateIntoEditor - Updating button states');
    updateButtonStates();
    
    // Scroll to the editor
    console.log('DEBUG: loadUpdateIntoEditor - Scrolling to the editor');
    document.getElementById('update-form').scrollIntoView({ behavior: 'smooth' });
    
    console.log('DEBUG: loadUpdateIntoEditor - Function complete');
}

// Check if an update already exists for the specified date - MODIFIED with loading flag and timeout
async function checkDateExists(dateStr, updateId = null) {
    console.log('DEBUG: checkDateExists - Checking if date exists:', dateStr, 'Excluding ID:', updateId);
    
    // Check if already running to prevent duplicate calls
    if (isCheckingDateExists) {
        console.log('DEBUG: checkDateExists - Already checking, aborting duplicate call');
        return false;
    }
	
	// NEW: Wait for auth stability before proceeding
    await window.waitForAuthStability();
    
    // Set loading flag
    isCheckingDateExists = true;
    
    try {
        console.log('DEBUG: checkDateExists - Building Supabase query');
        let query = supabase
            .from('prayer_updates')
            .select('id')
            .eq('update_date', dateStr);
            
        // If we're editing an existing update, exclude it from the check
        if (updateId) {
            console.log('DEBUG: checkDateExists - Excluding update with ID:', updateId);
            query = query.neq('id', updateId);
        }
        
        console.log('DEBUG: checkDateExists - Executing Supabase query with 5-second timeout');
        
        // Create a promise that will reject after 5 seconds
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Query timeout exceeded')), 5000);
        });
        
        // Race the query against the timeout
        const result = await Promise.race([
            query,
            timeoutPromise
        ]).catch(error => {
            // If error is from timeout
            if (error.message === 'Query timeout exceeded') {
                console.warn('DEBUG: checkDateExists - Query timed out after 5 seconds');
                return { data: [], error: null }; // Return empty data if timeout occurs
            }
            throw error; // Re-throw other errors
        });
        
        // Destructure the result (this is safe even if result is from the timeout)
        const { data, error } = result || { data: [], error: null };
        
        console.log('DEBUG: checkDateExists - Query complete or timed out');
        
        if (error) {
            console.error('DEBUG: checkDateExists - Supabase error:', error);
            throw error;
        }
        
        console.log('DEBUG: checkDateExists - Check result (exists):', data.length > 0);
        return data.length > 0;
    } catch (error) {
        console.error('DEBUG: checkDateExists - Error checking date existence:', error);
        // Log error but don't alert user for timeouts
        if (error.message === 'Query timeout exceeded') {
            console.warn('DEBUG: checkDateExists - Query timed out, returning false');
            return false;
        }
        // Only alert for non-timeout errors
        alert('Error checking if date exists: ' + error.message);
        return false;
    } finally {
        // Reset loading flag when done, regardless of success/failure
        isCheckingDateExists = false;
        console.log('DEBUG: checkDateExists - Reset loading flag');
    }
}

// Create a new prayer update or update an existing one
async function createPrayerUpdate(action, submitBtn) {
    console.log('DEBUG: createPrayerUpdate - Starting with action:', action);
    console.log('DEBUG: createPrayerUpdate - Current selectedUpdateId:', selectedUpdateId);
	
	// NEW: Wait for auth stability before proceeding
    await window.waitForAuthStability();
    
    // Get the original button text and disable the button
    const originalText = submitBtn.textContent;
    console.log('DEBUG: createPrayerUpdate - Original button text:', originalText);
    console.log('DEBUG: createPrayerUpdate - Disabling button and changing text');
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;
    
    try {
        // Get form values
        console.log('DEBUG: createPrayerUpdate - Getting form values');
        const titleElement = document.getElementById('update-title');
        const dateElement = document.getElementById('update-date');
        
        if (!titleElement) {
            console.error('DEBUG: createPrayerUpdate - Title element not found in DOM');
            throw new Error('Title element not found in DOM');
        }
        
        if (!dateElement) {
            console.error('DEBUG: createPrayerUpdate - Date element not found in DOM');
            throw new Error('Date element not found in DOM');
        }
        
        const title = titleElement.value.trim();
        const dateInput = dateElement.value;
        
        console.log('DEBUG: createPrayerUpdate - Retrieved title:', title);
        console.log('DEBUG: createPrayerUpdate - Retrieved date:', dateInput);
        
        // Get content from Quill editor
        let content = '';
        if (updateEditor && updateEditor.root) {
            content = updateEditor.root.innerHTML;
            console.log('DEBUG: createPrayerUpdate - Retrieved content length:', content.length);
            
            // Clean the content to remove color styling
            content = cleanupContentColors(content);
            console.log('DEBUG: createPrayerUpdate - Content cleaned to be theme-aware');
        } else {
            console.error('DEBUG: createPrayerUpdate - updateEditor or root element is not available');
            throw new Error('Editor not properly initialized');
        }
        
        // Validate inputs
        console.log('DEBUG: createPrayerUpdate - Validating inputs');
        if (!title) {
            console.error('DEBUG: createPrayerUpdate - Title is empty');
            throw new Error('Please enter a title for the prayer update');
        }
        
        if (!dateInput) {
            console.error('DEBUG: createPrayerUpdate - Date is empty');
            throw new Error('Please select a date for the prayer update');
        }
        
        if (!content || content === '<p><br></p>') {
            console.error('DEBUG: createPrayerUpdate - Content is empty');
            throw new Error('Please enter content for the prayer update');
        }
        
        // Check if we're editing an existing update or creating a new one
        const isEditing = selectedUpdateId !== null;
        console.log('DEBUG: createPrayerUpdate - Is editing existing update:', isEditing);
        
        // Check if the date already exists (for new entries or if changing date on edit)
        console.log('DEBUG: createPrayerUpdate - Checking if date exists');
        const dateExists = await checkDateExists(dateInput, isEditing ? selectedUpdateId : null);
        console.log('DEBUG: createPrayerUpdate - Date exists check result:', dateExists);
        
        if (dateExists) {
            console.error('DEBUG: createPrayerUpdate - A prayer update for this date already exists');
            throw new Error('A prayer update for this date already exists. Please edit the existing update or choose a different date.');
        }
        
        if (isEditing) {
            console.log('DEBUG: createPrayerUpdate - Updating existing prayer update with ID:', selectedUpdateId);
            // Update the existing prayer update
            console.log('DEBUG: createPrayerUpdate - Executing Supabase update query');
            const { data, error } = await supabase
                .from('prayer_updates')
                .update({
                    title,
                    content,
                    update_date: dateInput
                })
                .eq('id', selectedUpdateId);
                
            console.log('DEBUG: createPrayerUpdate - Update query complete');
            
            if (error) {
                console.error('DEBUG: createPrayerUpdate - Supabase error on update:', error);
                throw error;
            }
            
            console.log('DEBUG: createPrayerUpdate - Prayer update updated successfully:', data);
        } else {
            console.log('DEBUG: createPrayerUpdate - Creating new prayer update');
            // Create the prayer update
            console.log('DEBUG: createPrayerUpdate - Getting user ID');
            const userId = getUserId();
            console.log('DEBUG: createPrayerUpdate - User ID:', userId);
            
            console.log('DEBUG: createPrayerUpdate - Executing Supabase insert query');
            const { data, error } = await supabase
                .from('prayer_updates')
                .insert({
                    title,
                    content,
                    created_by: userId,
                    is_archived: false,
                    update_date: dateInput
                });
                
            console.log('DEBUG: createPrayerUpdate - Insert query complete');
            
            if (error) {
                console.error('DEBUG: createPrayerUpdate - Supabase error on insert:', error);
                throw error;
            }
            
            console.log('DEBUG: createPrayerUpdate - Prayer update created successfully:', data);
        }
        
        // Reset form and selection
        console.log('DEBUG: createPrayerUpdate - Clearing editor');
        clearEditor();
        
        // Reload updates
        console.log('DEBUG: createPrayerUpdate - Reloading updates list');
        loadUpdatesAdmin();
        
        // Send notifications if that button was clicked
        if (action === 'saveAndSend') {
            // Call the new batch email function
            console.log('DEBUG: createPrayerUpdate - Action is saveAndSend, calling batch email function');
            await sendUpdateNotifications(title, content, dateInput);
            showNotification('Success', `Prayer update ${isEditing ? 'updated' : 'saved'} and notification emails queued.`);
        } else {
            console.log('DEBUG: createPrayerUpdate - Action is saveOnly, not sending notifications');
            showNotification('Success', `Prayer update ${isEditing ? 'updated' : 'saved'} successfully.`);
        }
        
    } catch (error) {
        console.error('DEBUG: createPrayerUpdate - Error:', error);
        showNotification('Error', `Failed to ${selectedUpdateId ? 'update' : 'create'} prayer update: ${error.message}`);
    } finally {
        console.log('DEBUG: createPrayerUpdate - Restoring button state');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        console.log('DEBUG: createPrayerUpdate - Function complete');
    }
}

// Delete a prayer update
async function deleteUpdate(updateId) {
    console.log('DEBUG: deleteUpdate - Starting delete for update ID:', updateId);
	
	// Wait for auth stability before proceeding
    await window.waitForAuthStability();
	
    // Show the deletion confirmation modal instead of using confirm()
    const selectedUpdate = getSelectedUpdate();
    const confirmModal = document.getElementById('delete-update-confirm-modal');
    const updateTitleElement = document.getElementById('delete-update-title');
    const confirmIdInput = document.getElementById('delete-update-id');
    
    if (confirmModal && updateTitleElement && confirmIdInput) {
        // Set the update title and ID in the modal
        updateTitleElement.textContent = selectedUpdate ? selectedUpdate.title : 'this prayer update';
        confirmIdInput.value = updateId;
        
        // Show the modal
        const modal = new bootstrap.Modal(confirmModal);
        modal.show();
        
        // Set up one-time event handler for the confirm button
        const confirmButton = document.getElementById('confirm-delete-update');
        if (confirmButton) {
            // Remove any existing listeners to prevent duplicates
            const newConfirmButton = confirmButton.cloneNode(true);
            confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
            
            // Add the event listener to the new button
            newConfirmButton.addEventListener('click', async function() {
                // Hide the modal
                modal.hide();
                
                // Proceed with deletion
                try {
        // Delete the prayer update
        console.log('DEBUG: deleteUpdate - Executing Supabase delete query');
        const { data, error } = await supabase
            .from('prayer_updates')
            .delete()
            .eq('id', updateId);
            
        console.log('DEBUG: deleteUpdate - Delete query complete');
        
        if (error) {
            console.error('DEBUG: deleteUpdate - Supabase error:', error);
            throw error;
        }
        
        // Reset selected ID if we deleted the currently selected update
        if (selectedUpdateId === updateId) {
            console.log('DEBUG: deleteUpdate - Resetting selectedUpdateId');
            selectedUpdateId = null;
            updateButtonStates();
        }
        
        // Reload updates
        console.log('DEBUG: deleteUpdate - Reloading updates list');
        loadUpdatesAdmin();
        
        console.log('DEBUG: deleteUpdate - Showing success notification');
        showNotification('Success', 'Prayer update deleted successfully.');
        
    } catch (error) {
        console.error('DEBUG: deleteUpdate - Error deleting prayer update:', error);
        showNotification('Error', `Failed to delete prayer update: ${error.message}`);
    }
            });
        }
        
        return; // Exit the function - deletion will happen via the event handler if confirmed
    } else {
        console.error('DEBUG: deleteUpdate - Could not find confirmation modal elements');
        // Fallback to simple confirm if modal elements not found
        if (!confirm('Are you sure you want to delete this prayer update? This action cannot be undone.')) {
            console.log('DEBUG: deleteUpdate - User cancelled deletion');
            return;
        }
        
        // If confirmed with fallback, proceed with deletion
        try {
            // Delete the prayer update
            console.log('DEBUG: deleteUpdate - Executing Supabase delete query');
            const { data, error } = await supabase
                .from('prayer_updates')
                .delete()
                .eq('id', updateId);
                
            console.log('DEBUG: deleteUpdate - Delete query complete');
            
            if (error) {
                console.error('DEBUG: deleteUpdate - Supabase error:', error);
                throw error;
            }
            
            // Reset selected ID if we deleted the currently selected update
            if (selectedUpdateId === updateId) {
                console.log('DEBUG: deleteUpdate - Resetting selectedUpdateId');
                selectedUpdateId = null;
                updateButtonStates();
            }
            
            // Reload updates
            console.log('DEBUG: deleteUpdate - Reloading updates list');
            loadUpdatesAdmin();
            
            console.log('DEBUG: deleteUpdate - Showing success notification');
            showNotification('Success', 'Prayer update deleted successfully.');
        } catch (error) {
            console.error('DEBUG: deleteUpdate - Error deleting prayer update:', error);
            showNotification('Error', `Failed to delete prayer update: ${error.message}`);
        }
    }
    
    console.log('DEBUG: deleteUpdate - Function complete');
}

// Create an update card (for regular view)
function createUpdateCard(update) {
    console.log('DEBUG: createUpdateCard - Creating card for update ID:', update.id);
    // Format the date - include the update_date if available, otherwise use created_at
    const date = update.update_date ? new Date(update.update_date) : new Date(update.created_at);
    const formattedDate = date.toLocaleDateString(undefined, {
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    
    // Clean up content and wrap in a theme-aware container
    const cleanContent = cleanupContentColors(update.content);
    
    // Full card for regular user view
    let cardHtml = `
    <div class="card update-card mb-3">
        <div class="card-body">
            <h5 class="card-title">${update.title}</h5>
            <p class="update-date text-muted"><i class="bi bi-calendar"></i> ${formattedDate}</p>
            <div class="update-content content-container">
                ${cleanContent}
            </div>
        </div>
    </div>
    `;
    
    return cardHtml;
}

// Send notifications for a new prayer update
async function sendUpdateNotifications(title, content, dateInput) {
    console.log('DEBUG: sendUpdateNotifications - Starting notifications for title:', title);
    
    // Format the date for display
    const date = dateInput ? new Date(dateInput) : new Date();
    const formattedDate = date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    
    // Use both individual notifications and batch email for different delivery methods
    
    // 1. Call the central notification function which will handle all notification types
    // This will handle WhatsApp, SMS and other notification types
    try {
        await sendNotification('prayer_update', title, content, dateInput);
        console.log('DEBUG: sendUpdateNotifications - General notifications triggered successfully');
    } catch (notifyError) {
        console.error('DEBUG: sendUpdateNotifications - Error sending notifications:', notifyError);
    }
    
    // 2. Also call the batch-email Edge function without waiting for response (fire and forget)
    // This handles bulk email sending more efficiently
    console.log('DEBUG: sendUpdateNotifications - Calling batch-email Edge function (fire and forget)');
    
    supabase.functions.invoke('batch-email', {
        body: {
            title: title,
            date: formattedDate,
            content: content,
            type: 'update'
        }
    }).then(({ data, error }) => {
        if (error) {
            console.error('DEBUG: sendUpdateNotifications - Error calling batch-email:', error);
        } else {
            console.log('DEBUG: sendUpdateNotifications - Batch email function successfully invoked');
        }
    }).catch(error => {
        console.error('DEBUG: sendUpdateNotifications - Exception calling batch-email:', error);
    });
    
    return true;
}