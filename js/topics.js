// Prayer Topics Management Module

// Load the topic camera module
document.write('<script src="js/load-topic-camera.js"></script>');

// Variables to track state
let allTopics = [];
let filteredTopics = [];
let topicEditor = null;
let currentTopicId = null;
let editorInitialized = false;

// Initialize topics functionality
function initTopics() {
    if (!hasPermission('prayer_calendar_editor')) return;
    
    // Only initialize the editor once
    if (!editorInitialized) {
        // Set up the Quill editor for topic text
        topicEditor = new Quill('#topic-text-editor', {
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
            placeholder: ''
        });
        
        // Set up image selection for topic
        document.getElementById('select-topic-image').addEventListener('click', () => {
            document.getElementById('topic-image').click();
        });
        
        document.getElementById('topic-image').addEventListener('change', handleTopicImageSelection);
        
        // Set up topic form validation
        document.getElementById('topic-title').addEventListener('input', validateTopicForm);
        topicEditor.on('text-change', validateTopicForm);
        
        // Set up save topic button
        document.getElementById('save-topic').addEventListener('click', saveTopic);
        
        editorInitialized = true;
    }
    
    // These event listeners can be set up each time
    // Set up edit topics button
    document.getElementById('edit-topics-btn').addEventListener('click', openTopicManagement);
    
    // Set up add topic button
    document.getElementById('add-topic-btn').addEventListener('click', openAddTopicModal);
    
    // Set up search functionality
    document.getElementById('topic-search').addEventListener('input', function() {
        filterAndDisplayTopics(this.value);
    });
    
    // Load topics data
    loadTopics();
    
    // Create calendar days grid in the Topics tab
    createTopicsCalendarGrid();
}

// Variable to track the selected day for topics
let selectedTopicDay = null;

// Create calendar days grid for the Topics tab
function createTopicsCalendarGrid() {
    const container = document.querySelector('#other-content .calendar-days-grid');
    if (!container) return;
    
    container.innerHTML = '';
    
    for (let day = 1; day <= 31; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        dayElement.dataset.day = day;
        
        // If this day is the currently selected day, add the selected class
        if (day === selectedTopicDay) {
            dayElement.classList.add('selected');
        }
        
        dayElement.addEventListener('click', () => {
            // Remove selected class from all days
            document.querySelectorAll('#other-content .calendar-day').forEach(el => {
                el.classList.remove('selected');
            });
            
            // Add selected class to clicked day
            dayElement.classList.add('selected');
            selectedTopicDay = day;
            document.getElementById('topics-selected-day').textContent = day;
        });
        
        container.appendChild(dayElement);
    }
}

// Validate topic form
function validateTopicForm() {
    const titleField = document.getElementById('topic-title');
    const saveButton = document.getElementById('save-topic');
    
    // Check if title and text are provided
    const hasTitle = titleField.value.trim().length > 0;
    const hasText = topicEditor && topicEditor.getText().trim().length > 5; // At least a few characters
    
    // Enable/disable save button
    saveButton.disabled = !(hasTitle && hasText);
}

// Handle topic image selection
function handleTopicImageSelection(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validImageTypes.includes(file.type)) {
        showNotification('Error', 'Please select a valid image file (JPEG, PNG, GIF, WebP)', 'error');
        e.target.value = '';
        return;
    }
    
    // Preview the image
    const reader = new FileReader();
    reader.onload = function(event) {
        document.getElementById('topic-image-preview').src = event.target.result;
    };
    reader.readAsDataURL(file);
    
    // Force validation after image selection
    validateTopicForm();
}

// Call the topic management Edge Function
async function callTopicEdgeFunction(action, data) {
	// Get the auth token
    const authToken = window.authToken || await getAuthToken();
	console.log('In callTopicEdgeFunction');
    try {
        const functionUrl = `${SUPABASE_URL}/functions/v1/topic-management`;
        
        // Add user ID to the request data
        const requestData = {
            action,
            data,
            userId: getUserId()
        };
        console.log(`Calling topic edge function for ${functionUrl}`);
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Edge function error: ${response.status} - ${errorText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Error calling topic-management edge function (${action}):`, error);
        throw error;
    }
}

// Open topic management modal
async function openTopicManagement() {
    // Refresh topics list
    await loadTopics();
    
    // Generate HTML for topics list
    let html = '';
    if (allTopics.length === 0) {
        html = '<div class="alert alert-info">No topics found. Click "Add Topic" to create one.</div>';
    } else {
        html = '<div class="list-group">';
        allTopics.forEach(topic => {
            html += `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <h5 class="mb-1">${topic.topic_title}</h5>
                        <small class="text-muted">Day: ${topic.pray_day > 0 ? topic.pray_day : 'Unassigned'}</small>
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-primary edit-topic-btn flex-grow-1" data-topic-id="${topic.id}">
                        <i class="bi bi-pencil"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger delete-topic-btn flex-grow-1" data-topic-id="${topic.id}">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </div>
            </div>
            `;
        });
        html += '</div>';
    }
    
    // Update the modal content
    document.getElementById('topics-list-container').innerHTML = html;
    
    // Add event listeners to edit and delete buttons
    document.querySelectorAll('.edit-topic-btn').forEach(button => {
        button.addEventListener('click', () => {
            const topicId = button.dataset.topicId;
            openEditTopicModal(topicId);
        });
    });
    
    document.querySelectorAll('.delete-topic-btn').forEach(button => {
        button.addEventListener('click', () => {
            const topicId = button.dataset.topicId;
            confirmDeleteTopic(topicId);
        });
    });
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('topic-management-modal'));
    modal.show();
}

// Open add topic modal
function openAddTopicModal() {
    // Close the management modal
    const managementModal = bootstrap.Modal.getInstance(document.getElementById('topic-management-modal'));
    if (managementModal) {
        managementModal.hide();
    }
    
    // Reset form
    document.getElementById('topic-form').reset();
    document.getElementById('topic-id').value = '';
    currentTopicId = null;
    document.getElementById('topic-image-preview').src = 'img/placeholder-profile.png';
    
    // Clear Quill editor
    if (topicEditor) {
        topicEditor.root.innerHTML = '';
    }
    
    // Update modal title
    document.getElementById('topic-edit-title').textContent = 'Add Prayer Topic';
    
    // Disable save button until form is valid
    document.getElementById('save-topic').disabled = true;
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('topic-edit-modal'));
    modal.show();
    
    // Force validation to update button state
    setTimeout(validateTopicForm, 100);
}

// Open edit topic modal
function openEditTopicModal(topicId) {
    // Close the management modal
    const managementModal = bootstrap.Modal.getInstance(document.getElementById('topic-management-modal'));
    if (managementModal) {
        managementModal.hide();
    }
    
    // Find the topic in our data
    const topic = allTopics.find(t => t.id === topicId);
    if (!topic) {
        showNotification('Error', 'Topic not found', 'error');
        return;
    }
    
    // Set current topic ID
    currentTopicId = topicId;
    document.getElementById('topic-id').value = topicId;
    
    // Fill the form with topic data
    document.getElementById('topic-title').value = topic.topic_title;
    
    // Set Quill editor content
    if (topicEditor) {
        topicEditor.root.innerHTML = topic.topic_text;
    }
    
    // Set image preview
    if (topic.topic_image_url) {
        document.getElementById('topic-image-preview').src = topic.topic_image_url;
    } else {
        document.getElementById('topic-image-preview').src = 'img/placeholder-profile.png';
    }
    
    // Update modal title
    document.getElementById('topic-edit-title').textContent = 'Edit Prayer Topic';
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('topic-edit-modal'));
    modal.show();
    
    // Force validation to update button state
    setTimeout(validateTopicForm, 100);
}

// Save topic
async function saveTopic() {
    try {
        const saveButton = document.getElementById('save-topic');
        saveButton.disabled = true;
        saveButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        
        const topicId = document.getElementById('topic-id').value;
        const isNewTopic = !topicId;
        
        // Get form data
        const topicTitle = document.getElementById('topic-title').value.trim();
        // Get HTML content from Quill editor to preserve formatting
        const topicText = topicEditor ? topicEditor.root.innerHTML : '';
        
        // Prepare data for the Edge function
        const requestData = {
            topicId,
            topicTitle,
            topicText
        };
        
        // Handle image if selected
        const imageInput = document.getElementById('topic-image');
        if (imageInput.files && imageInput.files[0]) {
            const file = imageInput.files[0];
            
            // Read file as base64
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
            
            requestData.imageBase64 = base64;
            requestData.fileName = file.name;
        } else if (!isNewTopic) {
            // If editing and no new image selected, keep existing URL
            const existingTopic = allTopics.find(t => t.id === topicId);
            if (existingTopic && existingTopic.topic_image_url) {
                requestData.existingImageUrl = existingTopic.topic_image_url;
            }
        }
        
        // Call the Edge function
        const response = await callTopicEdgeFunction('saveTopic', requestData);
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to save topic');
        }
        
        // Close the edit modal
        const editModal = bootstrap.Modal.getInstance(document.getElementById('topic-edit-modal'));
        if (editModal) {
            editModal.hide();
        }
        
        // Show success notification
        showNotification('Success', response.message, 'success');
        
        // Reload the topics list to include the new/updated topic
        await loadTopics();
        
        // Reopen the topic management modal with updated list
        setTimeout(() => {
            openTopicManagement();
        }, 500);
        
    } catch (error) {
        console.error('Error saving topic:', error);
        showNotification('Error', `Failed to save topic: ${error.message}`, 'error');
    } finally {
        // Reset save button
        const saveButton = document.getElementById('save-topic');
        saveButton.disabled = false;
        saveButton.textContent = 'Save Topic';
    }
}

// Confirm topic deletion
function confirmDeleteTopic(topicId) {
    // Find the topic
    const topic = allTopics.find(t => t.id === topicId);
    
    if (!confirm(`Are you sure you want to delete the topic "${topic.topic_title}"? This action cannot be undone.`)) {
        return;
    }
    
    deleteTopic(topicId);
}

// Delete topic
async function deleteTopic(topicId) {
    try {
        // Call the Edge function to delete the topic
        const response = await callTopicEdgeFunction('deleteTopic', { topicId });
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to delete topic');
        }
        
        // Show success notification
        showNotification('Success', response.message + ' - Refreshing to update data...', 'success');
        
        // Save state before refreshing
        sessionStorage.setItem('topicDeleted', 'true');
        sessionStorage.setItem('lastAction', 'deleteTopic');
        
        // Save current view to restore after refresh
        const currentView = document.querySelector('.view-content:not(.d-none)')?.id || '';
        if (currentView) {
            sessionStorage.setItem('lastView', currentView);
            // Remember we were on the topics tab
            sessionStorage.setItem('activeCalendarTab', 'topics');
        }
        
        // Close the modal if it's open
        const modal = bootstrap.Modal.getInstance(document.getElementById('topic-management-modal'));
        if (modal) {
            modal.hide();
        }
        
        // Refresh the page after a short delay
        setTimeout(() => {
            window.location.reload();
        }, 1500);
        
    } catch (error) {
        console.error('Error deleting topic:', error);
        showNotification('Error', `Failed to delete topic: ${error.message}`, 'error');
    }
}

// Load all topics
async function loadTopics() {
	 await window.waitForAuthStability();
    try {
        const { data, error } = await supabase
            .from('prayer_topics')
            .select('*')
            .order('pray_day', { ascending: true })
            .order('topic_title', { ascending: true });
        
        if (error) throw error;
        
        allTopics = data || [];
        filterAndDisplayTopics();
        
        return allTopics;
    } catch (error) {
        console.error('Error loading topics:', error);
        showNotification('Error', `Failed to load topics: ${error.message}`, 'error');
        return [];
    }
}

// Filter and display topics
function filterAndDisplayTopics(searchTerm = '') {
    // Filter topics based on search term
    if (searchTerm) {
        filteredTopics = allTopics.filter(topic => 
            topic.topic_title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    } else {
        filteredTopics = [...allTopics];
    }
    
    // Separate topics into allocated and unallocated
    const unallocatedTopics = filteredTopics.filter(topic => topic.pray_day === 0);
    const allocatedTopics = filteredTopics.filter(topic => topic.pray_day > 0);
    
    // Sort allocated topics by day
    allocatedTopics.sort((a, b) => a.pray_day - b.pray_day);
    
    displayTopicList(unallocatedTopics, 'unallocated-topics-list', false);
    displayTopicList(allocatedTopics, 'allocated-topics-list', true);
}

// Updated function to display topic list with enhanced day selection
function displayTopicList(topics, containerId, isAllocated) {
    const container = document.getElementById(containerId);
    
    if (!container) {
        console.error(`Container not found: ${containerId}`);
        return;
    }
    
    if (topics.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No topics found</div>';
        return;
    }
    
    let html = '';
    
    topics.forEach(topic => {
        const imgSrc = topic.topic_image_url || 'img/placeholder-profile.png';
        
        // Get formatted text for the day assignment
        const dayAssignmentText = getFormattedDayText(topic.pray_day);
        
        if (isAllocated) {
            // Template for assigned topics
            html += `
            <div class="topic-card" data-topic-id="${topic.id}">
                <div class="topic-top-row">
                    <div class="topic-img-container">
                        <img src="${imgSrc}" alt="${topic.topic_title}" class="topic-img">
                    </div>
                    <div class="topic-title-container">
                        <div class="topic-title">${topic.topic_title}</div>
                    </div>
                </div>
                <div class="topic-badge-row">
                    <span class="badge bg-primary day-badge-inline">${dayAssignmentText}</span>
                </div>
                <div class="topic-bottom-row">
                    <select class="form-select day-frequency-selector" data-topic-id="${topic.id}">
                        <option value="custom" ${topic.pray_day >= 1 && topic.pray_day <= 31 ? 'selected' : ''}>Custom Day</option>
                        <option value="90" ${topic.pray_day === 90 ? 'selected' : ''}>Daily</option>
                        <option value="91" ${topic.pray_day === 91 ? 'selected' : ''}>Sunday</option>
                        <option value="92" ${topic.pray_day === 92 ? 'selected' : ''}>Monday</option>
                        <option value="93" ${topic.pray_day === 93 ? 'selected' : ''}>Tuesday</option>
                        <option value="94" ${topic.pray_day === 94 ? 'selected' : ''}>Wednesday</option>
                        <option value="95" ${topic.pray_day === 95 ? 'selected' : ''}>Thursday</option>
                        <option value="96" ${topic.pray_day === 96 ? 'selected' : ''}>Friday</option>
                        <option value="97" ${topic.pray_day === 97 ? 'selected' : ''}>Saturday</option>
                    </select>
                    <select class="form-select month-selector" data-topic-id="${topic.id}" ${topic.pray_day >= 90 ? 'disabled' : ''}>
                        <option value="0" ${topic.pray_months === 0 ? 'selected' : ''}>All months</option>
                        <option value="1" ${topic.pray_months === 1 ? 'selected' : ''}>Odd months</option>
                        <option value="2" ${topic.pray_months === 2 ? 'selected' : ''}>Even months</option>
                    </select>
                    <button class="btn btn-primary assign-topic" data-topic-id="${topic.id}">
                        Reassign
                    </button>
                </div>
            </div>
            `;
        } else {
            // Template for unassigned topics
            html += `
            <div class="topic-card" data-topic-id="${topic.id}">
                <div class="topic-top-row">
                    <div class="topic-img-container">
                        <img src="${imgSrc}" alt="${topic.topic_title}" class="topic-img">
                    </div>
                    <div class="topic-title-container">
                        <div class="topic-title">${topic.topic_title}</div>
                    </div>
                </div>
                <div class="topic-bottom-row">
                    <select class="form-select day-frequency-selector" data-topic-id="${topic.id}">
                        <option value="custom" selected>Custom Day</option>
                        <option value="90">Daily</option>
                        <option value="91">Sunday</option>
                        <option value="92">Monday</option>
                        <option value="93">Tuesday</option>
                        <option value="94">Wednesday</option>
                        <option value="95">Thursday</option>
                        <option value="96">Friday</option>
                        <option value="97">Saturday</option>
                    </select>
                    <select class="form-select month-selector" data-topic-id="${topic.id}">
                        <option value="0" ${topic.pray_months === 0 ? 'selected' : ''}>All months</option>
                        <option value="1" ${topic.pray_months === 1 ? 'selected' : ''}>Odd months</option>
                        <option value="2" ${topic.pray_months === 2 ? 'selected' : ''}>Even months</option>
                    </select>
                    <button class="btn btn-primary assign-topic" data-topic-id="${topic.id}">
                        Assign
                    </button>
                </div>
            </div>
            `;
        }
    });
    
    container.innerHTML = html;
    
    // Add event listeners to assign buttons
    container.querySelectorAll('.assign-topic').forEach(button => {
        button.addEventListener('click', () => {
            const topicId = button.dataset.topicId;
            assignTopicToDay(topicId);
        });
    });
    
    // Add event listeners to day frequency selectors
    container.querySelectorAll('.day-frequency-selector').forEach(select => {
        select.addEventListener('change', function() {
            const topicId = this.dataset.topicId;
            const value = parseInt(this.value);
            
            // Find the corresponding month selector
            const monthSelector = this.parentElement.querySelector('.month-selector');
            
            // Special values (90-97) disable month selector as they always apply
            if (value >= 90) {
                monthSelector.disabled = true;
                monthSelector.value = "0"; // Set to "All months" but it won't be used
                
                // If "custom" is not selected, directly update the pray_day value
                updateTopicDayFrequency(topicId, value);
            } else {
                // Regular day-of-month selection - enable month selector
                monthSelector.disabled = false;
            }
        });
    });
    
    // Add event listeners to month selectors
    container.querySelectorAll('.month-selector').forEach(select => {
        select.addEventListener('change', function() {
            const topicId = this.dataset.topicId;
            const months = parseInt(this.value);
            updateTopicMonths(topicId, months);
        });
    });
}

// New function to get formatted text for day assignment
function getFormattedDayText(prayDay) {
    if (prayDay === 90) {
        return "Daily";
    } else if (prayDay >= 91 && prayDay <= 97) {
        const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        return daysOfWeek[prayDay - 91];
    } else {
        return `Day ${prayDay}`;
    }
}

// New function to update topic day frequency
async function updateTopicDayFrequency(topicId, dayValue) {
    await window.waitForAuthStability();
    try {
        // For special values (90-97), we also need to set pray_months=0
        let updateData = { pray_day: dayValue };
        
        // If it's a special value (daily or day of week), set pray_months to 0
        if (dayValue >= 90) {
            updateData.pray_months = 0;
        }
        
        // Update the database
        const { data, error } = await supabase
            .from('prayer_topics')
            .update(updateData)
            .eq('id', topicId);
            
        if (error) throw error;
        
        // Update local data
        const topicIndex = allTopics.findIndex(topic => topic.id === topicId);
        if (topicIndex >= 0) {
            allTopics[topicIndex].pray_day = dayValue;
            if (dayValue >= 90) {
                allTopics[topicIndex].pray_months = 0;
            }
        }
        
        // Refresh display
        filterAndDisplayTopics();
        
        showNotification('Success', `Topic frequency updated to ${getFormattedDayText(dayValue)}`, 'success');
        
    } catch (error) {
        console.error('Error updating topic day frequency:', error);
        showNotification('Error', `Failed to update topic frequency: ${error.message}`, 'error');
    }
}

// Modified assignTopicToDay function to handle new day selection types
async function assignTopicToDay(topicId) {
    await window.waitForAuthStability();
    
    try {
        // Check if we have a special day frequency set
        const topicCard = document.querySelector(`.topic-card[data-topic-id="${topicId}"]`);
        if (!topicCard) {
            showNotification('Error', 'Topic card element not found', 'error');
            return;
        }
        
        const dayFrequencySelector = topicCard.querySelector('.day-frequency-selector');
        const dayFrequencyValue = parseInt(dayFrequencySelector.value);
        
        // If a special value (daily or day of week) is selected, use that directly
        if (dayFrequencyValue >= 90) {
            await updateTopicDayFrequency(topicId, dayFrequencyValue);
            return;
        }
        
        // Otherwise, it's a custom day selection, so use the selected day from the calendar
        const selectedDay = parseInt(document.getElementById('topics-selected-day').textContent);
        
        if (isNaN(selectedDay) || selectedDay < 1 || selectedDay > 31) {
            showNotification('Warning', 'Please select a valid day first', 'warning');
            return;
        }
        
        // Store the selected day so it stays highlighted
        selectedTopicDay = selectedDay;
        
        // Directly update the database using Supabase
        const { data, error } = await supabase
            .from('prayer_topics')
            .update({ pray_day: selectedDay })
            .eq('id', topicId);
            
        if (error) throw error;
        
        // Update local data
        const topicIndex = allTopics.findIndex(topic => topic.id === topicId);
        if (topicIndex >= 0) {
            allTopics[topicIndex].pray_day = selectedDay;
        }
        
        // Refresh display
        filterAndDisplayTopics();
        
        // Ensure the day remains selected visually
        document.querySelectorAll('#other-content .calendar-day').forEach(el => {
            el.classList.remove('selected');
            if (parseInt(el.dataset.day) === selectedDay) {
                el.classList.add('selected');
            }
        });
        
        showNotification('Success', 'Topic assigned to day ' + selectedDay, 'success');
        
    } catch (error) {
        console.error('Error assigning topic:', error);
        showNotification('Error', `Failed to assign topic: ${error.message}`, 'error');
    }
}

// Update the topic's months settings
async function updateTopicMonths(topicId, months) {
	 await window.waitForAuthStability();
    try {
        // Directly update the database using Supabase
        const { data, error } = await supabase
            .from('prayer_topics')
            .update({ pray_months: months })
            .eq('id', topicId);
            
        if (error) throw error;
        
        // Update local data
        const topicIndex = allTopics.findIndex(topic => topic.id === topicId);
        if (topicIndex >= 0) {
            allTopics[topicIndex].pray_months = months;
        }
        
        // Refresh display
        filterAndDisplayTopics();
        
        showNotification('Success', 'Month settings updated', 'success');
        
    } catch (error) {
        console.error('Error updating months:', error);
        showNotification('Error', `Failed to update months: ${error.message}`, 'error');
        
        // Reset the select element to its previous value
        const topic = allTopics.find(t => t.id === topicId);
        const select = document.querySelector(`.month-selector[data-topic-id="${topicId}"]`);
        if (topic && select) {
            select.value = topic.pray_months;
        }
    }
}

// Function to view a topic card
async function viewTopicCard(topicId) {
	 await window.waitForAuthStability();
    try {
        // Get the topic details
        const { data, error } = await supabase
            .from('prayer_topics')
            .select('*')
            .eq('id', topicId)
            .single();
            
        if (error) throw error;
        
        // Set modal content
        document.getElementById('card-modal-title').textContent = data.topic_title;
        document.getElementById('card-image').src = data.topic_image_url || 'img/placeholder-profile.png';
        document.getElementById('card-content').innerHTML = `
            <div>
                ${data.topic_text}
            </div>
        `;
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('view-card-modal'));
        modal.show();
        
    } catch (error) {
        console.error('Error viewing topic card:', error);
        showNotification('Error', `Failed to load topic details: ${error.message}`, 'error');
    }
}

// Initialize topics on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize topics functionality when the "other-tab" (now "Assign Topics") is clicked
    document.getElementById('other-tab').addEventListener('click', () => {
        initTopics();
    });
    
    // Check for state restoration after page refresh
    if (sessionStorage.getItem('topicSaved') === 'true' || 
        sessionStorage.getItem('topicDeleted') === 'true' || 
        sessionStorage.getItem('topicAssigned') === 'true' || 
        sessionStorage.getItem('topicMonthsUpdated') === 'true') {
        
        // Clear flags
        sessionStorage.removeItem('topicSaved');
        sessionStorage.removeItem('topicDeleted');
        sessionStorage.removeItem('topicAssigned');
        sessionStorage.removeItem('topicMonthsUpdated');
        
        // Show a success message about the completed action
        const lastAction = sessionStorage.getItem('lastAction');
        if (lastAction) {
            let message = 'Operation completed successfully';
            switch (lastAction) {
                case 'saveTopic':
                    message = 'Topic saved successfully';
                    break;
                case 'deleteTopic':
                    message = 'Topic deleted successfully';
                    break;
                case 'assignTopic':
                    message = 'Topic assigned successfully';
                    break;
                case 'updateMonths':
                    message = 'Month settings updated successfully';
                    break;
            }
            showNotification('Success', message, 'success');
            sessionStorage.removeItem('lastAction');
        }
        
        // Navigate back to the Topics tab if that's where we were
        if (sessionStorage.getItem('activeCalendarTab') === 'topics') {
            // First show the manage-calendar-view
            showView('manage-calendar-view');
            
            // Then activate the Topics tab
            const topicsTab = document.getElementById('other-tab');
            if (topicsTab) {
                // Use Bootstrap's tab API to activate the tab
                const tabInstance = new bootstrap.Tab(topicsTab);
                tabInstance.show();
                
                // Initialize the topics functionality
                initTopics();
            }
            
            // Clear the flag
            sessionStorage.removeItem('activeCalendarTab');
        }
    }
});