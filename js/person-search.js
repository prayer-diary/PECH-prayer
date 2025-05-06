// Enhanced date picker with person search functionality
// Add this code to calendar.js or include it as a separate file

// Set up the person search functionality
function setupPersonSearch() {
    // Get DOM elements
    const searchInput = document.getElementById('person-search');
    const searchButton = document.getElementById('search-person-btn');
    const searchResults = document.getElementById('person-search-results');
    const searchInstructions = document.getElementById('search-instructions');
    const noResultsMessage = document.getElementById('no-results-message');
    const searchSpinner = document.getElementById('search-spinner');
    
    // Add event listeners
    searchButton.addEventListener('click', performPersonSearch);
    searchInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            performPersonSearch();
        }
    });
    
    // Set up the tab change event - clear results when switching tabs
    document.getElementById('date-tab').addEventListener('click', clearSearchResults);
    document.getElementById('person-tab').addEventListener('click', () => {
        // Focus on the search input when the Person tab is selected
        setTimeout(() => {
            searchInput.focus();
        }, 300);
    });
}

// Perform the person search
async function performPersonSearch() {
    // Get DOM elements
    const searchInput = document.getElementById('person-search');
    const searchTerm = searchInput.value.trim();
    const searchResults = document.getElementById('person-search-results');
    const searchInstructions = document.getElementById('search-instructions');
    const noResultsMessage = document.getElementById('no-results-message');
    const searchSpinner = document.getElementById('search-spinner');
    
    // Validate search term
    if (!searchTerm) {
        return;
    }
    
    // Show loading spinner and hide other elements
    searchInstructions.classList.add('d-none');
    searchResults.classList.add('d-none');
    noResultsMessage.classList.add('d-none');
    searchSpinner.classList.remove('d-none');
    
    try {
        // Wait for auth stability before making database queries
        await window.waitForAuthStability();
        
        // Query the database for profiles matching the search term
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, pray_day, pray_months, photo_tag, profile_image_url')
            .eq('approval_state', 'Approved')
            .eq('calendar_hide', false)
            .gt('pray_day', 0) // Only include people assigned to a day
            .ilike('full_name', `%${searchTerm}%`)
            .order('full_name', { ascending: true });
            
        if (error) throw error;
        
        // Hide spinner
        searchSpinner.classList.add('d-none');
        
        // Display results or no results message
        if (data && data.length > 0) {
            // Build results HTML
            let html = '';
            data.forEach(person => {
                // Get display name (photo_tag or full_name)
                const displayName = person.photo_tag || person.full_name;
                // Get day suffix
                const daySuffix = getDaySuffix(person.pray_day);
                // Get months text
                const monthsText = getMonthsText(person.pray_months);
                
                html += `
                <button type="button" class="list-group-item list-group-item-action d-flex align-items-center person-result" 
                        data-person-id="${person.id}" 
                        data-pray-day="${person.pray_day}"
                        data-pray-months="${person.pray_months}">
                    <div class="me-3" style="width: 40px; height: 40px; overflow: hidden; border-radius: 50%;">
                        <img src="${person.profile_image_url || 'img/placeholder-profile.png'}" class="img-fluid" alt="${displayName}">
                    </div>
                    <div>
                        <div class="fw-bold">${displayName}</div>
                        <div class="text-muted small">Day ${person.pray_day}${daySuffix} ${monthsText}</div>
                    </div>
                </button>
                `;
            });
            
            // Update the results container
            searchResults.innerHTML = html;
            searchResults.classList.remove('d-none');
            
            // Add click event listeners to results
            document.querySelectorAll('.person-result').forEach(button => {
                button.addEventListener('click', handlePersonSelection);
            });
        } else {
            // No results found
            noResultsMessage.classList.remove('d-none');
        }
    } catch (error) {
        console.error('Error searching for people:', error);
        // Hide spinner
        searchSpinner.classList.add('d-none');
        // Show error message
        noResultsMessage.textContent = `Error searching for people: ${error.message}`;
        noResultsMessage.classList.remove('d-none');
    }
}

// Handle when a person is selected from search results
function handlePersonSelection(event) {
    // Get the selected person's data
    const personElement = event.currentTarget;
    const prayDay = parseInt(personElement.dataset.prayDay);
    const prayMonths = parseInt(personElement.dataset.prayMonths);
    
    // Create a date object for navigation
    const targetDate = calculateTargetDate(prayDay, prayMonths);
    
    // Close the modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('date-picker-modal'));
    if (modal) modal.hide();
    
    // Set the selected date and navigate to it
    window.selectedPrayerDate = targetDate;
    
    // Show a notification
    showNotification('Person Found', `Showing prayers for ${formatDate(targetDate, true)}`, 'success');
    
    // Load the prayer calendar for the selected date
    loadPrayerCalendar();
}

// Calculate the target date based on pray_day and pray_months
function calculateTargetDate(prayDay, prayMonths) {
    // Start with current date
    const currentDate = new Date();
    
    // Create a new date with the prayer day
    const targetDate = new Date(currentDate);
    targetDate.setDate(prayDay);
    
    // Handle month selection based on pray_months
    // 0 = all months, 1 = odd months, 2 = even months
    if (prayMonths > 0) {
        const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
        const isCurrentMonthOdd = currentMonth % 2 === 1;
        
        if ((prayMonths === 1 && !isCurrentMonthOdd) || (prayMonths === 2 && isCurrentMonthOdd)) {
            // Current month doesn't match the required type (odd/even)
            // Move to the next month
            targetDate.setMonth(targetDate.getMonth() + 1);
        }
    }
    
    return targetDate;
}

// Clear search results
function clearSearchResults() {
    const searchInput = document.getElementById('person-search');
    const searchResults = document.getElementById('person-search-results');
    const searchInstructions = document.getElementById('search-instructions');
    const noResultsMessage = document.getElementById('no-results-message');
    const searchSpinner = document.getElementById('search-spinner');
    
    // Clear input and results
    searchInput.value = '';
    searchResults.innerHTML = '';
    
    // Hide results and error message, show instructions
    searchResults.classList.add('d-none');
    noResultsMessage.classList.add('d-none');
    searchSpinner.classList.add('d-none');
    searchInstructions.classList.remove('d-none');
}

// Helper function to get day suffix (1st, 2nd, 3rd, etc.)
function getDaySuffix(day) {
    if (day >= 11 && day <= 13) {
        return 'th';
    }
    
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

// Helper function to get months text
function getMonthsText(prayMonths) {
    switch (prayMonths) {
        case 0: return '(All months)';
        case 1: return '(Odd months)';
        case 2: return '(Even months)';
        default: return '';
    }
}

// Modify the existing setupDatePickerHandlers function to include person search setup
function setupDatePickerHandlers() {
    // Get the buttons
    const setButton = document.getElementById('set-test-date');
    const resetButton = document.getElementById('reset-test-date');
    
    // Remove existing event listeners to prevent duplication
    const newSetButton = setButton.cloneNode(true);
    const newResetButton = resetButton.cloneNode(true);
    
    setButton.parentNode.replaceChild(newSetButton, setButton);
    resetButton.parentNode.replaceChild(newResetButton, resetButton);
    
    // Add new event listeners
    newSetButton.addEventListener('click', () => {
        const dateInput = document.getElementById('test-date');
        if (dateInput.value) {
            // Set the selectedPrayerDate for the app to use
            window.selectedPrayerDate = new Date(dateInput.value);
            
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('date-picker-modal'));
            if (modal) modal.hide();
            
            // Reload the prayer calendar
            loadPrayerCalendar();
        }
    });
    
    newResetButton.addEventListener('click', () => {
        // Reset the selected date
        window.selectedPrayerDate = null;
        
        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('date-picker-modal'));
        if (modal) modal.hide();
        
        // Reload the prayer calendar
        loadPrayerCalendar();
    });
    
    // Set up person search functionality
    setupPersonSearch();
}

// Modify the showDatePicker function to initialize the person search tab
function showDatePicker() {
    // Get the current effective date
    const currentDate = getEffectiveDate();
    
    // Format the date for the input (YYYY-MM-DD)
    const formattedDate = currentDate.toISOString().split('T')[0];
    
    // Set the input value
    const dateInput = document.getElementById('test-date');
    if (dateInput) {
        dateInput.value = formattedDate;
    }
    
    // Show the date picker modal
    const modal = new bootstrap.Modal(document.getElementById('date-picker-modal'));
    
    // Change the modal title to be more user-friendly
    const modalTitle = document.getElementById('date-picker-title');
    if (modalTitle) {
        modalTitle.textContent = 'Select Prayer Date';
    }
    
    // Clear any previous search results
    clearSearchResults();
    
    // Show the modal
    modal.show();
    
    // Make sure event handlers are properly set
    setupDatePickerHandlers();
}