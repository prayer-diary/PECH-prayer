// Urgent Prayer Requests Module - Restructured to match updates.js pattern

// Global variables for editors
let urgentEditor;
let editUrgentEditor;
let initUrgentEditorFlag = false;
let selectedUrgentId = null; // Track selected urgent prayer

// Loading flags to prevent duplicate calls
let isLoadingUrgentAdmin = false;

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

// Initialize the Rich Text Editor for urgent prayers
function initUrgentEditor() {
    console.log('DEBUG: initUrgentEditor - Start initialization');
    if (initUrgentEditorFlag) {
        console.log('DEBUG: initUrgentEditor - Duplicate call detected, aborting');
        return;
    }
    
    // Define custom formats that exclude direct color styling
    const allowedFormats = [
        'bold', 'italic', 'underline', 'strike', 
        'header', 'list', 'indent', 
        'link', 'image', 'direction', 'align', 'blockquote'
        // Notice we're NOT including 'color' in the allowed formats
    ];
        
    // Initialize urgent editor if not already initialized
    if (!urgentEditor) {
        console.log('DEBUG: initUrgentEditor - Creating main urgent editor');
        urgentEditor = new Quill('#urgent-editor', {
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
        console.log('DEBUG: initUrgentEditor - Setting up text-change event handler');
        urgentEditor.on('text-change', function() {
            console.log('DEBUG: Quill text-change event triggered');
            updateUrgentButtonStates();
        });
    }
    
    // Initialize edit urgent editor if not already initialized
    if (!editUrgentEditor) {
        console.log('DEBUG: initUrgentEditor - Creating edit urgent editor');
        editUrgentEditor = new Quill('#edit-urgent-editor', {
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
            placeholder: 'Edit urgent prayer request...',
        });
    }
    
    // Set today's date in the date field
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    const dateField = document.getElementById('urgent-date');
    console.log('DEBUG: initUrgentEditor - Setting default date:', formattedDate);
    if (dateField) {
        dateField.value = formattedDate;
    } else {
        console.error('DEBUG: initUrgentEditor - Date field not found in DOM');
    }
    
    // Set up direct click handlers for buttons
    console.log('DEBUG: initUrgentEditor - Setting up button handlers');
    const saveAndSendUrgentBtn = document.getElementById('save-and-send-urgent-btn');
    const saveOnlyUrgentBtn = document.getElementById('save-only-urgent-btn');
    const clearUrgentBtn = document.getElementById('clear-urgent-btn');
    const editUrgentBtn = document.getElementById('edit-urgent-btn');
    const deleteUrgentBtn = document.getElementById('delete-urgent-btn');
    
    if (saveAndSendUrgentBtn) {
        console.log('DEBUG: initUrgentEditor - Found save-and-send-urgent-btn, adding click handler');
        saveAndSendUrgentBtn.addEventListener('click', function(e) {
            console.log('DEBUG: saveAndSendUrgentBtn click event triggered');
            e.preventDefault();
            createUrgentPrayer('saveAndSend', this);
        });
    } else {
        console.error('DEBUG: initUrgentEditor - Save and send button not found in DOM');
    }
    
    if (saveOnlyUrgentBtn) {
        console.log('DEBUG: initUrgentEditor - Found save-only-urgent-btn, adding click handler');
        saveOnlyUrgentBtn.addEventListener('click', function(e) {
            console.log('DEBUG: saveOnlyUrgentBtn click event triggered');
            e.preventDefault();
            createUrgentPrayer('saveOnly', this);
        });
    } else {
        console.error('DEBUG: initUrgentEditor - Save only button not found in DOM');
    }
    
    if (clearUrgentBtn) {
        console.log('DEBUG: initUrgentEditor - Found clear-urgent-btn, adding click handler');
        clearUrgentBtn.addEventListener('click', function(e) {
            console.log('DEBUG: clearUrgentBtn click event triggered');
            e.preventDefault();
            clearUrgentEditor();
        });
    } else {
        console.error('DEBUG: initUrgentEditor - Clear button not found in DOM');
    }
    
    if (editUrgentBtn) {
        console.log('DEBUG: initUrgentEditor - Found edit-urgent-btn, adding click handler');
        editUrgentBtn.addEventListener('click', function(e) {
            console.log('DEBUG: editUrgentBtn click event triggered');
            e.preventDefault();
            if (selectedUrgentId) {
                console.log('DEBUG: editUrgentBtn - selectedUrgentId exists:', selectedUrgentId);
                const selectedUrgent = getSelectedUrgent();
                if (selectedUrgent) {
                    console.log('DEBUG: editUrgentBtn - Found selected urgent:', selectedUrgent);
                    loadUrgentIntoEditor(selectedUrgent);
                } else {
                    console.error('DEBUG: editUrgentBtn - Could not find selected urgent object');
                }
            } else {
                console.log('DEBUG: editUrgentBtn - No urgent prayer selected');
            }
        });
    } else {
        console.error('DEBUG: initUrgentEditor - Edit urgent button not found in DOM');
    }
    
    if (deleteUrgentBtn) {
        console.log('DEBUG: initUrgentEditor - Found delete-urgent-btn, adding click handler');
        deleteUrgentBtn.addEventListener('click', function(e) {
            console.log('DEBUG: deleteUrgentBtn click event triggered');
            e.preventDefault();
            if (selectedUrgentId) {
                console.log('DEBUG: deleteUrgentBtn - Calling deleteUrgent with id:', selectedUrgentId);
                deleteUrgentPrayer(selectedUrgentId);
            } else {
                console.log('DEBUG: deleteUrgentBtn - No urgent prayer selected');
            }
        });
    } else {
        console.error('DEBUG: initUrgentEditor - Delete urgent button not found in DOM');
    }
    
    // Initial button state update
    console.log('DEBUG: initUrgentEditor - Initial button state update');
    updateUrgentButtonStates();
    
    initUrgentEditorFlag = true;
    console.log('DEBUG: initUrgentEditor - Initialization complete');
}

// Clear the editor with confirmation
function clearUrgentEditor() {
    console.log('DEBUG: clearUrgentEditor - Starting clear operation');
    
    // Reset form directly without confirmation
    console.log('DEBUG: clearUrgentEditor - Resetting form');
    document.getElementById('urgent-form').reset();
    
    console.log('DEBUG: clearUrgentEditor - Clearing Quill editor');
    urgentEditor.setContents([]);
    
    // Set today's date in the date field
    console.log('DEBUG: clearUrgentEditor - Setting default date');
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    const dateField = document.getElementById('urgent-date');
    if (dateField) {
        dateField.value = formattedDate;
    }
    
    // Reset selection
    console.log('DEBUG: clearUrgentEditor - Resetting selection state');
    selectedUrgentId = null;
    updateUrgentButtonStates();
    
    // Clear selection highlight in the urgent prayers list
    console.log('DEBUG: clearUrgentEditor - Clearing selection highlight');
    const allRows = document.querySelectorAll('.urgent-list-item');
    allRows.forEach(row => row.classList.remove('selected'));
    
    console.log('DEBUG: clearUrgentEditor - Clear operation complete');
}

// Update button states based on current content and selection
function updateUrgentButtonStates() {
    console.log('DEBUG: updateUrgentButtonStates - Updating button states');
    const saveAndSendUrgentBtn = document.getElementById('save-and-send-urgent-btn');
    const saveOnlyUrgentBtn = document.getElementById('save-only-urgent-btn');
    const editUrgentBtn = document.getElementById('edit-urgent-btn');
    const deleteUrgentBtn = document.getElementById('delete-urgent-btn');
    
    // Get current editor content
    let editorContent = '';
    if (urgentEditor && urgentEditor.root) {
        editorContent = urgentEditor.root.innerHTML;
        console.log('DEBUG: updateUrgentButtonStates - Current editor content length:', editorContent.length);
    } else {
        console.error('DEBUG: updateUrgentButtonStates - urgentEditor or root element is not available');
    }
    
    const isEmpty = !editorContent || editorContent === '<p><br></p>';
    console.log('DEBUG: updateUrgentButtonStates - Editor is empty:', isEmpty);
    
    let titleContent = '';
    const titleElement = document.getElementById('urgent-title');
    if (titleElement) {
        titleContent = titleElement.value.trim();
        console.log('DEBUG: updateUrgentButtonStates - Title content:', titleContent);
    } else {
        console.error('DEBUG: updateUrgentButtonStates - Title element not found');
    }
    
    // Update Save buttons - enabled if both title and content exist
    if (saveAndSendUrgentBtn) {
        saveAndSendUrgentBtn.disabled = isEmpty || !titleContent;
        console.log('DEBUG: updateUrgentButtonStates - saveAndSendUrgentBtn disabled:', saveAndSendUrgentBtn.disabled);
    } else {
        console.log('DEBUG: updateUrgentButtonStates - saveAndSendUrgentBtn not found');
    }
    
    if (saveOnlyUrgentBtn) {
        saveOnlyUrgentBtn.disabled = isEmpty || !titleContent;
        console.log('DEBUG: updateUrgentButtonStates - saveOnlyUrgentBtn disabled:', saveOnlyUrgentBtn.disabled);
    } else {
        console.log('DEBUG: updateUrgentButtonStates - saveOnlyUrgentBtn not found');
    }
    
    // Update Edit button - enabled if editor is empty and an urgent prayer is selected
    if (editUrgentBtn) {
        editUrgentBtn.disabled = !isEmpty || !selectedUrgentId;
        console.log('DEBUG: updateUrgentButtonStates - editUrgentBtn disabled:', editUrgentBtn.disabled);
    } else {
        console.log('DEBUG: updateUrgentButtonStates - editUrgentBtn not found');
    }
    
    // Update Delete button - enabled if an urgent prayer is selected
    if (deleteUrgentBtn) {
        deleteUrgentBtn.disabled = !selectedUrgentId;
        console.log('DEBUG: updateUrgentButtonStates - deleteUrgentBtn disabled:', deleteUrgentBtn.disabled);
    } else {
        console.log('DEBUG: updateUrgentButtonStates - deleteUrgentBtn not found');
    }
    
    console.log('DEBUG: updateUrgentButtonStates - Button states updated');
}

// Get the currently selected urgent prayer object
function getSelectedUrgent() {
    console.log('DEBUG: getSelectedUrgent - Getting selected urgent prayer with ID:', selectedUrgentId);
    // This will be defined by the loadUrgentAdmin function
    const allUrgentData = window.allUrgentPrayers || [];
    console.log('DEBUG: getSelectedUrgent - Total urgent prayers in memory:', allUrgentData.length);
    const urgent = allUrgentData.find(urgent => urgent.id === selectedUrgentId);
    console.log('DEBUG: getSelectedUrgent - Found urgent prayer:', urgent ? 'yes' : 'no');
    return urgent;
}

// Load all urgent prayer requests for the user view
async function loadUrgentPrayers() {
    console.log('DEBUG: loadUrgentPrayers - Starting to load urgent prayers for user view');
    if (!isApproved()) {
        console.log('DEBUG: loadUrgentPrayers - User not approved, aborting');
        return;
    }
	
    await window.waitForAuthStability();
    
    // Get container element
    const container = document.getElementById('urgent-prayers-container');
    
    // Show loading indicator
    console.log('DEBUG: loadUrgentPrayers - Showing loading spinner');
    container.innerHTML = createLoadingSpinner();
    
    try {
        // Load urgent prayers ordered by date (most recent first)
        console.log('DEBUG: loadUrgentPrayers - Executing Supabase query');
        const { data, error } = await supabase
            .from('urgent_prayers')
            .select('*')
            .order('update_date', { ascending: false });
            
        console.log('DEBUG: loadUrgentPrayers - Query complete');
        
        if (error) {
            console.error('DEBUG: loadUrgentPrayers - Supabase error:', error);
            throw error;
        }
        
        console.log('DEBUG: loadUrgentPrayers - Retrieved urgent prayers count:', data ? data.length : 0);
        
        // Store urgent prayers for later reference
        window.allUrgentPrayers = data || [];
        
        // Display urgent prayers
        if (data.length === 0) {
            console.log('DEBUG: loadUrgentPrayers - No urgent prayers to display');
            container.innerHTML = `
                <div class="alert alert-info">
                    No urgent prayer requests at this time.
                </div>
            `;
        } else {
            let html = '';
            data.forEach(prayer => {
                html += createUrgentCard(prayer);
            });
            container.innerHTML = html;
            console.log('DEBUG: loadUrgentPrayers - Urgent prayers displayed');
        }
        
    } catch (error) {
        console.error('DEBUG: loadUrgentPrayers - Error loading urgent prayers:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                Error loading urgent prayer requests: ${error.message}
            </div>
        `;
    }
    
    console.log('DEBUG: loadUrgentPrayers - Function complete');
}

// Load urgent prayers for admin view - MODIFIED to match updates.js pattern
async function loadUrgentAdmin() {
    console.log('DEBUG: loadUrgentAdmin - Starting to load urgent prayers for admin view');
    
    // Check if already loading to prevent duplicate calls
    if (isLoadingUrgentAdmin) {
        console.log('DEBUG: loadUrgentAdmin - Already loading, aborting duplicate call');
        return;
    }
	
    // Wait for auth stability before proceeding
    await window.waitForAuthStability();
    
    // Set loading flag
    isLoadingUrgentAdmin = true;
    
    if (!hasPermission('urgent_prayer_editor')) {
        console.error('DEBUG: loadUrgentAdmin - User lacks permission, aborting');
        isLoadingUrgentAdmin = false; // Reset flag
        return;
    }
    
    // Get container element for all urgent prayers
    const container = document.getElementById('admin-urgent-container');
    if (!container) {
        console.error('DEBUG: loadUrgentAdmin - Container not found in DOM');
        isLoadingUrgentAdmin = false; // Reset flag
        return;
    }
    
    // Show loading indicator
    console.log('DEBUG: loadUrgentAdmin - Showing loading spinner');
    container.innerHTML = createLoadingSpinner();
    
    try {
        // Load all urgent prayers ordered by date (most recent first)
        console.log('DEBUG: loadUrgentAdmin - Executing Supabase query');
        const { data: urgentPrayers, error } = await supabase
            .from('urgent_prayers')
            .select('*')
            .order('update_date', { ascending: false });
            
        console.log('DEBUG: loadUrgentAdmin - Query complete');
        
        if (error) {
            console.error('DEBUG: loadUrgentAdmin - Supabase error:', error);
            throw error;
        }
        
        console.log('DEBUG: loadUrgentAdmin - Retrieved urgent prayers count:', urgentPrayers ? urgentPrayers.length : 0);
        
        // Store the urgent prayers data for later reference
        console.log('DEBUG: loadUrgentAdmin - Storing urgent prayers in window.allUrgentPrayers');
        window.allUrgentPrayers = urgentPrayers;
        
        // Display urgent prayers
        if (urgentPrayers.length === 0) {
            console.log('DEBUG: loadUrgentAdmin - No urgent prayers to display');
            container.innerHTML = `
                <div class="alert alert-info">
                    No urgent prayer requests available. Create one using the form.
                </div>
            `;
        } else {
            // Create a list to hold the urgent prayer items
            console.log('DEBUG: loadUrgentAdmin - Building HTML for urgent prayers');
            let html = '<div class="list-group">';
            urgentPrayers.forEach(prayer => {
                html += createUrgentListItem(prayer);
            });
            html += '</div>';
            container.innerHTML = html;
            console.log('DEBUG: loadUrgentAdmin - Urgent prayers displayed');
            
            // Add selection event listeners
            console.log('DEBUG: loadUrgentAdmin - Adding event listeners to list items');
            container.querySelectorAll('.urgent-list-item').forEach(item => {
                // Single click to select
                item.addEventListener('click', (e) => {
                    console.log('DEBUG: urgent-list-item click event triggered');
                    const urgentId = item.getAttribute('data-id');
                    console.log('DEBUG: urgent-list-item - Urgent ID clicked:', urgentId);
                    
                    // Remove selected class from all items
                    container.querySelectorAll('.urgent-list-item').forEach(row => {
                        row.classList.remove('selected');
                    });
                    
                    // Add selected class to clicked item
                    item.classList.add('selected');
                    
                    // Update selected ID
                    selectedUrgentId = urgentId;
                    console.log('DEBUG: urgent-list-item - selectedUrgentId set to:', selectedUrgentId);
                    
                    // Update button states
                    updateUrgentButtonStates();
                });
                
                // Double click to edit
                item.addEventListener('dblclick', (e) => {
                    console.log('DEBUG: urgent-list-item dblclick event triggered');
                    const urgentId = item.getAttribute('data-id');
                    console.log('DEBUG: urgent-list-item - Urgent ID double-clicked:', urgentId);
                    const urgentPrayer = urgentPrayers.find(u => u.id === urgentId);
                    
                    // Check if editor is empty before loading
                    const editorContent = urgentEditor.root.innerHTML;
                    const isEmpty = !editorContent || editorContent === '<p><br></p>';
                    console.log('DEBUG: urgent-list-item - Editor is empty:', isEmpty);
                    
                    if (isEmpty && urgentPrayer) {
                        console.log('DEBUG: urgent-list-item - Loading urgent prayer into editor');
                        loadUrgentIntoEditor(urgentPrayer);
                    } else if (!isEmpty) {
                        console.log('DEBUG: urgent-list-item - Editor not empty, showing warning');
                        showNotification('Warning', 'Please clear the editor before editing an existing urgent prayer.', 'warning');
                    }
                });
            });
        }
        
    } catch (error) {
        console.error('DEBUG: loadUrgentAdmin - Error loading admin urgent prayers:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                Error loading urgent prayer requests: ${error.message}
            </div>
        `;
    } finally {
        // Reset loading flag when done, regardless of success/failure
        isLoadingUrgentAdmin = false;
        console.log('DEBUG: loadUrgentAdmin - Reset loading flag');
    }
    
    console.log('DEBUG: loadUrgentAdmin - Function complete');
}

// Create a list item for an urgent prayer in the admin view
function createUrgentListItem(prayer) {
    console.log('DEBUG: createUrgentListItem - Creating item for urgent ID:', prayer.id);
    // Format the date
    const date = prayer.update_date ? new Date(prayer.update_date) : new Date(prayer.created_at);
    const formattedDate = date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    
    let listItemHtml = `
    <div class="list-group-item d-flex justify-content-between align-items-center urgent-list-item" data-id="${prayer.id}">
        <div>
            <h6 class="mb-0">${prayer.title}</h6>
            <small class="text-muted"><i class="bi bi-calendar"></i> ${formattedDate}</small>
        </div>
    </div>
    `;
    
    return listItemHtml;
}

// Load an urgent prayer into the main editor
function loadUrgentIntoEditor(prayer) {
    console.log('DEBUG: loadUrgentIntoEditor - Loading urgent prayer into editor, ID:', prayer.id);
    
    // Set the title
    console.log('DEBUG: loadUrgentIntoEditor - Setting title:', prayer.title);
    document.getElementById('urgent-title').value = prayer.title;
    
    // Set the date if available
    if (prayer.update_date) {
        console.log('DEBUG: loadUrgentIntoEditor - Setting date:', prayer.update_date);
        document.getElementById('urgent-date').value = prayer.update_date;
    } else {
        console.log('DEBUG: loadUrgentIntoEditor - No update_date available');
        // Set today's date as fallback
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        document.getElementById('urgent-date').value = formattedDate;
    }
    
    // Set content in main Quill editor
    console.log('DEBUG: loadUrgentIntoEditor - Setting content in Quill editor');
    urgentEditor.root.innerHTML = prayer.content;
    
    // Set the selected ID to prevent re-editing
    selectedUrgentId = prayer.id;
    console.log('DEBUG: loadUrgentIntoEditor - Set selectedUrgentId to:', selectedUrgentId);
    
    // Update button states
    console.log('DEBUG: loadUrgentIntoEditor - Updating button states');
    updateUrgentButtonStates();
    
    // Scroll to the editor
    console.log('DEBUG: loadUrgentIntoEditor - Scrolling to the editor');
    document.getElementById('urgent-form').scrollIntoView({ behavior: 'smooth' });
    
    console.log('DEBUG: loadUrgentIntoEditor - Function complete');
}

// Create a new urgent prayer request or update an existing one
async function createUrgentPrayer(action, submitBtn) {
    console.log('DEBUG: createUrgentPrayer - Starting with action:', action);
    console.log('DEBUG: createUrgentPrayer - Current selectedUrgentId:', selectedUrgentId);
	
    // Wait for auth stability before proceeding
    await window.waitForAuthStability();
    
    // Get the original button text and disable the button
    const originalText = submitBtn.textContent;
    console.log('DEBUG: createUrgentPrayer - Original button text:', originalText);
    console.log('DEBUG: createUrgentPrayer - Disabling button and changing text');
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;
    
    try {
        // Get form values
        console.log('DEBUG: createUrgentPrayer - Getting form values');
        const titleElement = document.getElementById('urgent-title');
        const dateElement = document.getElementById('urgent-date');
        
        if (!titleElement) {
            console.error('DEBUG: createUrgentPrayer - Title element not found in DOM');
            throw new Error('Title element not found in DOM');
        }
        
        if (!dateElement) {
            console.error('DEBUG: createUrgentPrayer - Date element not found in DOM');
            throw new Error('Date element not found in DOM');
        }
        
        const title = titleElement.value.trim();
        const dateInput = dateElement.value;
        
        console.log('DEBUG: createUrgentPrayer - Retrieved title:', title);
        console.log('DEBUG: createUrgentPrayer - Retrieved date:', dateInput);
        
        // Get content from Quill editor
        let content = '';
        if (urgentEditor && urgentEditor.root) {
            content = urgentEditor.root.innerHTML;
            console.log('DEBUG: createUrgentPrayer - Retrieved content length:', content.length);
            
            // Clean the content to remove color styling
            content = cleanupContentColors(content);
            console.log('DEBUG: createUrgentPrayer - Content cleaned to be theme-aware');
        } else {
            console.error('DEBUG: createUrgentPrayer - urgentEditor or root element is not available');
            throw new Error('Editor not properly initialized');
        }
        
        // Validate inputs
        console.log('DEBUG: createUrgentPrayer - Validating inputs');
        if (!title) {
            console.error('DEBUG: createUrgentPrayer - Title is empty');
            throw new Error('Please enter a title for the urgent prayer request');
        }
        
        if (!dateInput) {
            console.error('DEBUG: createUrgentPrayer - Date is empty');
            throw new Error('Please select a date for the urgent prayer request');
        }
        
        if (!content || content === '<p><br></p>') {
            console.error('DEBUG: createUrgentPrayer - Content is empty');
            throw new Error('Please enter content for the urgent prayer request');
        }
        
        // Check if we're editing an existing urgent prayer or creating a new one
        const isEditing = selectedUrgentId !== null;
        console.log('DEBUG: createUrgentPrayer - Is editing existing urgent prayer:', isEditing);
        
        if (isEditing) {
            console.log('DEBUG: createUrgentPrayer - Updating existing urgent prayer with ID:', selectedUrgentId);
            // Update the existing urgent prayer
            console.log('DEBUG: createUrgentPrayer - Executing Supabase update query');
            const { data, error } = await supabase
                .from('urgent_prayers')
                .update({
                    title,
                    content,
                    update_date: dateInput
                })
                .eq('id', selectedUrgentId);
                
            console.log('DEBUG: createUrgentPrayer - Update query complete');
            
            if (error) {
                console.error('DEBUG: createUrgentPrayer - Supabase error on update:', error);
                throw error;
            }
            
            console.log('DEBUG: createUrgentPrayer - Urgent prayer updated successfully:', data);
        } else {
            console.log('DEBUG: createUrgentPrayer - Creating new urgent prayer');
            // Create the urgent prayer
            console.log('DEBUG: createUrgentPrayer - Getting user ID');
            const userId = getUserId();
            console.log('DEBUG: createUrgentPrayer - User ID:', userId);
            
            console.log('DEBUG: createUrgentPrayer - Executing Supabase insert query');
            const { data, error } = await supabase
                .from('urgent_prayers')
                .insert({
                    title,
                    content,
                    created_by: userId,
                    update_date: dateInput
                });
                
            console.log('DEBUG: createUrgentPrayer - Insert query complete');
            
            if (error) {
                console.error('DEBUG: createUrgentPrayer - Supabase error on insert:', error);
                throw error;
            }
            
            console.log('DEBUG: createUrgentPrayer - Urgent prayer created successfully:', data);
        }
        
        // Reset form and selection
        console.log('DEBUG: createUrgentPrayer - Clearing editor');
        clearUrgentEditor();
        
        // Reload urgent prayers
        console.log('DEBUG: createUrgentPrayer - Reloading urgent prayers list');
        loadUrgentAdmin();
        
        // Send notifications if that button was clicked
        if (action === 'saveAndSend' ) {
            // Call the batch email function for urgent prayers (fire and forget)
            console.log('DEBUG: createUrgentPrayer - Action is saveAndSend, calling batch email function');
            sendUrgentNotifications(title, content, dateInput);
            showNotification('Success', `Urgent prayer request ${isEditing ? 'updated' : 'saved'} and notification emails queued.`);
        } else {
            console.log('DEBUG: createUrgentPrayer - Action is saveOnly, not sending notifications');
            showNotification('Success', `Urgent prayer request ${isEditing ? 'updated' : 'saved'} successfully.`);
        }
        
    } catch (error) {
        console.error('DEBUG: createUrgentPrayer - Error:', error);
        showNotification('Error', `Failed to ${selectedUrgentId ? 'update' : 'create'} urgent prayer request: ${error.message}`);
    } finally {
        console.log('DEBUG: createUrgentPrayer - Restoring button state');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        console.log('DEBUG: createUrgentPrayer - Function complete');
    }
}

// Delete an urgent prayer
async function deleteUrgentPrayer(urgentId) {
    console.log('DEBUG: deleteUrgentPrayer - Starting delete for urgent ID:', urgentId);
	
    // Wait for auth stability before proceeding
    await window.waitForAuthStability();
    
    // Show the deletion confirmation modal instead of using confirm()
    const selectedUrgent = getSelectedUrgent();
    const confirmModal = document.getElementById('delete-urgent-confirm-modal');
    const urgentTitleElement = document.getElementById('delete-urgent-title');
    const confirmIdInput = document.getElementById('delete-urgent-id');
    
    if (confirmModal && urgentTitleElement && confirmIdInput) {
        // Set the urgent prayer title and ID in the modal
        urgentTitleElement.textContent = selectedUrgent ? selectedUrgent.title : 'this urgent prayer request';
        confirmIdInput.value = urgentId;
        
        // Show the modal
        const modal = new bootstrap.Modal(confirmModal);
        modal.show();
        
        // Set up one-time event handler for the confirm button
        const confirmButton = document.getElementById('confirm-delete-urgent');
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
                    // Delete the urgent prayer
                    console.log('DEBUG: deleteUrgentPrayer - Executing Supabase delete query');
                    const { data, error } = await supabase
                        .from('urgent_prayers')
                        .delete()
                        .eq('id', urgentId);
                        
                    console.log('DEBUG: deleteUrgentPrayer - Delete query complete');
                    
                    if (error) {
                        console.error('DEBUG: deleteUrgentPrayer - Supabase error:', error);
                        throw error;
                    }
                    
                    // Reset selected ID if we deleted the currently selected urgent prayer
                    if (selectedUrgentId === urgentId) {
                        console.log('DEBUG: deleteUrgentPrayer - Resetting selectedUrgentId');
                        selectedUrgentId = null;
                        updateUrgentButtonStates();
                    }
                    
                    // Reload urgent prayers
                    console.log('DEBUG: deleteUrgentPrayer - Reloading urgent prayers list');
                    loadUrgentAdmin();
                    
                    console.log('DEBUG: deleteUrgentPrayer - Showing success notification');
                    showNotification('Success', 'Urgent prayer request deleted successfully.');
                    
                } catch (error) {
                    console.error('DEBUG: deleteUrgentPrayer - Error deleting urgent prayer:', error);
                    showNotification('Error', `Failed to delete urgent prayer request: ${error.message}`);
                }
            });
        }
        
        return; // Exit the function - deletion will happen via the event handler if confirmed
    } else {
        console.error('DEBUG: deleteUrgentPrayer - Could not find confirmation modal elements');
        // Fallback to simple confirm if modal elements not found
        if (!confirm('Are you sure you want to delete this urgent prayer request? This action cannot be undone.')) {
            console.log('DEBUG: deleteUrgentPrayer - User cancelled deletion');
            return;
        }
        
        // If confirmed with fallback, proceed with deletion
        try {
            // Delete the urgent prayer
            console.log('DEBUG: deleteUrgentPrayer - Executing Supabase delete query');
            const { data, error } = await supabase
                .from('urgent_prayers')
                .delete()
                .eq('id', urgentId);
                
            console.log('DEBUG: deleteUrgentPrayer - Delete query complete');
            
            if (error) {
                console.error('DEBUG: deleteUrgentPrayer - Supabase error:', error);
                throw error;
            }
            
            // Reset selected ID if we deleted the currently selected urgent prayer
            if (selectedUrgentId === urgentId) {
                console.log('DEBUG: deleteUrgentPrayer - Resetting selectedUrgentId');
                selectedUrgentId = null;
                updateUrgentButtonStates();
            }
            
            // Reload urgent prayers
            console.log('DEBUG: deleteUrgentPrayer - Reloading urgent prayers list');
            loadUrgentAdmin();
            
            console.log('DEBUG: deleteUrgentPrayer - Showing success notification');
            showNotification('Success', 'Urgent prayer request deleted successfully.');
        } catch (error) {
            console.error('DEBUG: deleteUrgentPrayer - Error deleting urgent prayer:', error);
            showNotification('Error', `Failed to delete urgent prayer request: ${error.message}`);
        }
    }
    
    console.log('DEBUG: deleteUrgentPrayer - Function complete');
}

// Create an urgent prayer card (for regular view)
function createUrgentCard(prayer) {
    console.log('DEBUG: createUrgentCard - Creating card for urgent ID:', prayer.id);
    
    // Format the date
    const date = prayer.update_date ? new Date(prayer.update_date) : new Date(prayer.created_at);
    const formattedDate = date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    
    // Clean up content and wrap in a theme-aware container
    const cleanContent = cleanupContentColors(prayer.content);
    
    // Full card for regular user view
    let cardHtml = `
    <div class="card urgent-card mb-3 border-danger">
        <div class="card-header bg-primary text-white">
            <h5 class="card-title mb-0">${prayer.title}</h5>
        </div>
        <div class="card-body">
            <p class="urgent-date text-muted"><i class="bi bi-calendar"></i> ${formattedDate}</p>
            <div class="urgent-content content-container">
                ${cleanContent}
            </div>
        </div>
    </div>
    `;
    
    return cardHtml;
}

// Helper function to format dates consistently
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Send notifications for urgent prayers
async function sendUrgentNotifications(title, content, dateInput) {
    console.log('DEBUG: sendUrgentNotifications - Starting notifications for title:', title);
    
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
        await sendNotification('urgent_prayer', title, content, dateInput);
        console.log('DEBUG: sendUrgentNotifications - General notifications triggered successfully');
    } catch (notifyError) {
        console.error('DEBUG: sendUrgentNotifications - Error sending notifications:', notifyError);
    }
    
    // 2. Also call the batch-email Edge function without waiting for response (fire and forget)
    // This handles bulk email sending more efficiently
    console.log('DEBUG: sendUrgentNotifications - Calling batch-email Edge function (fire and forget)');
    
    supabase.functions.invoke('batch-email', {
        body: {
            title: title,
            date: formattedDate,
            content: content,
            type: 'urgent'
        }
    }).then(({ data, error }) => {
        if (error) {
            console.error('DEBUG: sendUrgentNotifications - Error calling batch-email:', error);
        } else {
            console.log('DEBUG: sendUrgentNotifications - Batch email function successfully invoked');
        }
    }).catch(error => {
        console.error('DEBUG: sendUrgentNotifications - Exception calling batch-email:', error);
    });
    
    return true;
}