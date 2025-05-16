// Print Calendar Module - Handles PDF generation of prayer calendar

// Initialize the printing module
document.addEventListener('DOMContentLoaded', function() {
    // Add event listener for the print calendar menu item
    const printCalendarMenuItem = document.getElementById('nav-print-calendar');
    if (printCalendarMenuItem) {
        printCalendarMenuItem.addEventListener('click', function() {
            showView('print-calendar-view');
            initPrintCalendarView();
        });
    }
    
    // Add event listeners for the print options form
    const dateRangeSelect = document.getElementById('print-date-range');
    if (dateRangeSelect) {
        dateRangeSelect.addEventListener('change', function() {
            if (this.value === 'custom') {
                document.getElementById('custom-date-range').classList.remove('d-none');
            } else {
                document.getElementById('custom-date-range').classList.add('d-none');
            }
        });
    }
    
    // Font family change event listener to update preview
    const fontFamilySelect = document.getElementById('print-font-family');
    if (fontFamilySelect) {
        fontFamilySelect.addEventListener('change', function() {
            generatePreview(); // Regenerate preview when font changes
        });
    }
    
    // Cover page checkbox event listener to update preview
    const includeCoverCheckbox = document.getElementById('include-cover-pages');
    if (includeCoverCheckbox) {
        includeCoverCheckbox.addEventListener('change', function() {
            generatePreview(); // Regenerate preview when cover page option changes
        });
    }
    
    // Generate PDF button event listener
    const generateBtn = document.getElementById('generate-pdf-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', function() {
            // Prevent multiple clicks
            if (this.dataset.generating === 'true') {
                return;
            }
            
            this.dataset.generating = 'true';
            this.disabled = true;
            
            // Re-enable after a delay
            setTimeout(() => {
                this.dataset.generating = 'false';
                this.disabled = false;
            }, 5000);
            
            generatePDF();
        });
    }
});

// Initialize the print calendar view
async function initPrintCalendarView() {
    // Set default dates
    const today = new Date();
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const startDateInput = document.getElementById('print-start-date');
    const endDateInput = document.getElementById('print-end-date');
    
    if (startDateInput) {
        startDateInput.valueAsDate = startOfMonth;
    }
    
    if (endDateInput) {
        endDateInput.valueAsDate = endOfMonth;
    }
    
    // Set default date range to "All Prayer Cards"
    const dateRangeSelect = document.getElementById('print-date-range');
    if (dateRangeSelect) {
        dateRangeSelect.value = 'all';
    }
    
    // Make sure the cover page checkbox is checked by default
    const includeCoverCheckbox = document.getElementById('include-cover-pages');
    if (includeCoverCheckbox) {
        includeCoverCheckbox.checked = true;
    }
    
    // Generate a preview
    generatePreview();
}

// Generate a preview of the prayer calendar
async function generatePreview() {
    const previewContainer = document.getElementById('print-preview-container');
    if (!previewContainer) return;
    
    // Show loading indicator
    previewContainer.innerHTML = `
        <div class="text-center my-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Generating preview...</p>
        </div>
    `;
    
    try {
        // Get the prayer cards based on the selected options
        const prayerCards = await getPrayerCards();
        
        // If no prayer cards found
        if (!prayerCards || prayerCards.length === 0) {
            previewContainer.innerHTML = `
                <div class="alert alert-info">
                    <h5>No prayer cards found</h5>
                    <p>No prayer cards found for the selected date range.</p>
                    <p>Try selecting a different date range or check that users have been assigned to days in the Prayer Calendar management.</p>
                </div>
            `;
            return;
        }
        
        // Check if cover page is enabled
        const includeCoverCheckbox = document.getElementById('include-cover-pages');
        const includeCover = includeCoverCheckbox ? includeCoverCheckbox.checked : true;
        
        // Generate the preview HTML - show all cards in preview
        const previewHTML = generatePrintHTML(prayerCards, includeCover);
        
        // Base URL for resolving relative paths
        const baseURL = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
        
		// Create the preview with better sizing
		previewContainer.innerHTML = `
			<div class="alert alert-info mb-3">
				<strong>Preview:</strong> Showing sample of ${prayerCards.length} prayer cards. 
				The complete calendar will group cards by day number.
			</div>
			<div class="border p-2" style="background-color: #f8f9fa; height: calc(80vh - 150px); overflow: hidden;">
				<iframe id="preview-iframe" style="width: 100%; height: 100%; border: 1px solid #ddd;" frameborder="0"></iframe>
			</div>
		`;
        
        // Get selected font family
        const fontFamilySelect = document.getElementById('print-font-family');
        const fontFamily = fontFamilySelect ? fontFamilySelect.value : 'Arial, sans-serif';
        console.log('Selected font family for preview:', fontFamily);
        
        // Important: Small delay to ensure the iframe is fully in the DOM
        setTimeout(() => {
            try {
                // Get the iframe and write content to it
                const previewIframe = document.getElementById('preview-iframe');
                if (!previewIframe) {
                    console.error('Preview iframe not found');
                    return;
                }
                
                const iframeDoc = previewIframe.contentDocument || previewIframe.contentWindow.document;
                if (!iframeDoc) {
                    console.error('Could not access iframe document');
                    return;
                }
                
                iframeDoc.open();
                iframeDoc.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Prayer Diary Preview</title>
                        <base href="${baseURL}">
                        <style>
                            html, body {
                                margin: 0;
                                padding: 0;
                                font-family: ${fontFamily} !important;
                                background-color: white;
                            }
                            * {
                                font-family: ${fontFamily} !important;
                            }
                            .print-page {
                                width: 148mm;
                                height: 210mm;
                                padding: 5mm;
                                margin: 0 auto;
                                border: 1px solid #ddd;
                                background-color: white;
                                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                                position: relative;
                                font-family: ${fontFamily} !important;
                            }
                            .print-prayer-card {
                                display: flex;
                                flex-direction: column;
                                margin-bottom: 5mm;
                                padding: 3mm;
                                border-radius: 2mm;
                                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                                background-color: #fff;
                                border: 1px solid #eee;
                                font-family: ${fontFamily} !important;
                            }
                            .print-prayer-card:last-child {
                                margin-bottom: 0;
                            }
                            .print-card-header {
                                margin-bottom: 3mm;
                                font-family: ${fontFamily} !important;
                            }
                            .print-name {
                                font-size: 14pt;
                                font-weight: bold;
                                margin: 0;
                                color: #000;
                                font-family: ${fontFamily} !important;
                            }
                            .print-card-body {
                                display: flex;
                                font-family: ${fontFamily} !important;
                            }
                            .print-image-container {
                                margin-right: 5mm;
                                flex-shrink: 0;
                                display: flex;
                                align-items: flex-start;
                            }
                            .print-profile-image {
                                max-width: 35mm;
                                max-height: 50mm;
                                object-fit: contain;
                                border-radius: 3mm;
                                border: 1px solid #eee;
                            }
                            .print-prayer-points {
                                flex: 1;
                                font-size: 10pt;
                                font-family: ${fontFamily} !important;
                            }
                            .print-prayer-points p {
                                margin-bottom: 0.5rem;
                                font-family: ${fontFamily} !important;
                            }
                            .print-footer {
                                position: absolute;
                                bottom: 5mm;
                                left: 10mm;
                                right: 10mm;
                                text-align: center;
                                font-size: 14pt;
                                font-weight: bold;
                                color: #333;
                                font-family: ${fontFamily} !important;
                            }
                            .print-date {
                                font-style: italic;
                                color: #666;
                                font-size: 9pt;
                                margin-bottom: 1mm;
                                font-family: ${fontFamily} !important;
                            }
                            h1, h2, h3, h4, h5, h6, p, span, div {
                                font-family: ${fontFamily} !important;
                            }
                            /* Cover page styles */
                            .cover-page {
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                height: 100%;
                                text-align: center;
                                border: 10px solid #e0e0e0;
                                border-radius: 10mm;
                                padding: 20mm;
                                box-sizing: border-box;
                            }
                            .cover-logo {
                                width: 70mm;
                                max-height: 70mm;
                                margin-bottom: 10mm;
                            }
                            .cover-title {
                                font-size: 24pt;
                                font-weight: bold;
                                margin-bottom: 5mm;
                                color: #000;
                            }
                            .cover-church-name {
                                font-size: 18pt;
                                margin-bottom: 10mm;
                                color: #000;
                            }
                            .cover-date {
                                font-size: 18pt;
                                margin-top: 5mm;
                                color: #333;
                            }
                        </style>
                        <script>
                            // Fix image loading errors
                            window.addEventListener('load', function() {
                                console.log("Preview iframe loaded with font family: '${fontFamily}'");
                                document.body.style.fontFamily = '${fontFamily}';
                                
                                // Apply font to all elements
                                document.querySelectorAll('*').forEach(el => {
                                    if (el.style) {
                                        el.style.fontFamily = '${fontFamily}';
                                    }
                                });
                                
                                // Fix any broken images
                                document.querySelectorAll('img').forEach(img => {
                                    img.onerror = function() {
                                        this.onerror = null;
                                        this.src = 'img/placeholder-profile.png';
                                    };
                                });
                            });
                        </script>
                    </head>
                    <body style="font-family: ${fontFamily} !important;">
                        ${previewHTML}
                    </body>
                    </html>
                `);
                iframeDoc.close();
                
                // Additional enforcement of font after iframe loads
                previewIframe.onload = function() {
                    try {
                        const doc = previewIframe.contentDocument || previewIframe.contentWindow.document;
                        doc.body.style.fontFamily = fontFamily;
                        
                        // Force font family on all elements
                        const allElements = doc.querySelectorAll('*');
                        for (let i = 0; i < allElements.length; i++) {
                            if (allElements[i].style) {
                                allElements[i].style.fontFamily = fontFamily;
                            }
                        }
                    } catch (e) {
                        console.error('Error setting font after iframe load:', e);
                    }
                };
            } catch (err) {
                console.error('Error writing to preview iframe:', err);
            }
        }, 100);
        
    } catch (error) {
        console.error('Error generating preview:', error);
        previewContainer.innerHTML = `
            <div class="alert alert-danger">
                <h5>Error generating preview</h5>
                <p>${error.message || 'Unknown error'}</p>
                <p>Check the console for more details.</p>
            </div>
        `;
    }
}

// Generate the PDF
async function generatePDF() {
    // Track if print dialog is open
    window.isGeneratingPDF = true;
    let printDialogOpened = false;
    
    try {
        // Show loading notification
        const loadingToastId = showToast('Processing', 'Generating prayer diary PDF...', 'processing');
        
        // Get the prayer cards based on the selected options
        const prayerCards = await getPrayerCards();
        
        // If no prayer cards found
        if (!prayerCards || prayerCards.length === 0) {
            dismissToast(loadingToastId);
            showToast('Error', 'No prayer cards found for the selected date range.', 'error');
            window.isGeneratingPDF = false;
            return;
        }
        
        // Check if cover page is enabled
        const includeCoverCheckbox = document.getElementById('include-cover-pages');
        const includeCover = includeCoverCheckbox ? includeCoverCheckbox.checked : true;
        
        // Generate the full HTML for all pages
        const printHTML = generatePrintHTML(prayerCards, includeCover);
        
        // Get selected font family
        const fontFamilySelect = document.getElementById('print-font-family');
        const fontFamily = fontFamilySelect ? fontFamilySelect.value : 'Arial, sans-serif';
        console.log('Selected font family for PDF:', fontFamily);
        
        // Create a hidden iframe with unique ID to avoid conflicts
        const iframeId = 'print-frame-' + Date.now();
        const iframe = document.createElement('iframe');
        iframe.id = iframeId;
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.name = iframeId; // Unique name to avoid conflicts
        document.body.appendChild(iframe);
        
        // Base URL for resolving relative paths
        const baseURL = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
        
        // Create a message listener with a unique scope to avoid conflicts
        const messageListener = function(event) {
            if (event.data === 'printContentReady' && !printDialogOpened) {
                printDialogOpened = true;
                
                // Remove the event listener to avoid duplicates
                window.removeEventListener('message', messageListener);
                
                dismissToast(loadingToastId);
                
                // Print the iframe with a slight delay
                setTimeout(() => {
                    try {
                        iframe.contentWindow.print();
                        showToast('Success', 'Prayer diary generated successfully.', 'success');
                    } catch (printError) {
                        console.error('Error during print operation:', printError);
                        showToast('Error', 'Failed to open print dialog. Please try again.', 'error');
                    }
                    
                    // Remove the iframe after a delay
                    setTimeout(() => {
                        if (document.body.contains(iframe)) {
                            document.body.removeChild(iframe);
                        }
                        window.isGeneratingPDF = false;
                    }, 1000);
                }, 300);
            }
        };
        
        // Add message listener
        window.addEventListener('message', messageListener);
        
        // Write the HTML to the iframe
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        
        iframeDoc.open();
        iframeDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Prayer Diary</title>
                <base href="${baseURL}">
                <style>
                    @page {
                        size: 148mm 210mm; /* A5 size in mm */
                        margin: 0mm; /* Minimum margins */
                    }
                    html, body {
                        margin: 0;
                        padding: 0;
                        font-family: ${fontFamily} !important;
                        background-color: white;
                    }
                    * {
                        font-family: ${fontFamily} !important;
                    }
                    .print-page {
                        width: 148mm;
                        height: 210mm;
                        padding: 5mm; /* Reduced padding */
                        margin: 0;
                        page-break-after: always;
                        position: relative;
                        box-sizing: border-box;
                        font-family: ${fontFamily} !important;
                    }
                    .print-prayer-card {
                        display: flex;
                        flex-direction: column;
                        margin-bottom: 5mm;
                        padding: 3mm;
                        border-radius: 2mm;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                        background-color: #fff;
                        border: 1px solid #eee;
                        font-family: ${fontFamily} !important;
                    }
                    .print-prayer-card:last-child {
                        margin-bottom: 0;
                        padding-bottom: 0;
                    }
                    .print-card-header {
                        margin-bottom: 3mm;
                        font-family: ${fontFamily} !important;
                    }
                    .print-name {
                        font-size: 14pt;
                        font-weight: bold;
                        margin: 0;
                        color: #000;
                        font-family: ${fontFamily} !important;
                    }
                    .print-card-body {
                        display: flex;
                        font-family: ${fontFamily} !important;
                        align-items: center;
                    }
                    .print-image-container {
                        margin-right: 5mm;
                        flex-shrink: 0;
                        display: flex;
                        align-items: flex-start;
                    }
                    .print-profile-image {
                        max-width: 35mm;
                        max-height: 50mm;
                        object-fit: contain;
                        border-radius: 3mm;
                        border: 1px solid #eee;
                    }
                    .print-prayer-points {
                        flex: 1;
                        font-size: 10pt;
                        font-family: ${fontFamily} !important;
                    }
                    .print-prayer-points p {
                        margin-bottom: 0.5rem;
                        font-family: ${fontFamily} !important;
                    }
                    .print-footer {
                        position: absolute;
                        bottom: 5mm;
                        left: 10mm;
                        right: 10mm;
                        text-align: center;
                        font-size: 14pt;
                        font-weight: bold;
                        color: #333;
                        font-family: ${fontFamily} !important;
                    }
                    .print-date {
                        font-style: italic;
                        color: #666;
                        font-size: 9pt;
                        margin-bottom: 1mm;
                        font-family: ${fontFamily} !important;
                    }
                    h1, h2, h3, h4, h5, h6, p, span, div {
                        font-family: ${fontFamily} !important;
                    }
                    /* Cover page styles */
                    .cover-page {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100%;
                        text-align: center;
                        border: 10px solid #e0e0e0;
                        border-radius: 10mm;
                        padding: 20mm;
                        box-sizing: border-box;
                    }
                    .cover-logo {
                        width: 70mm;
                        max-height: 70mm;
                        margin-bottom: 10mm;
                    }
                    .cover-title {
                        font-size: 24pt;
                        font-weight: bold;
                        margin-bottom: 5mm;
                        color: #000;
                    }
                    .cover-church-name {
                        font-size: 18pt;
                        margin-bottom: 10mm;
                        color: #000;
                    }
                    .cover-date {
                        font-size: 18pt;
                        margin-top: 5mm;
                        color: #333;
                    }
                    .back-cover-page {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100%;
                        text-align: center;
                        border: 10px solid #e0e0e0;
                        border-radius: 10mm;
                        padding: 20mm;
                        box-sizing: border-box;
                    }
                </style>
                <script>
                    // Flag to ensure print is only called once
                    let printCalled = false;
                    
                    // Helper function to fix image loading errors
                    function handleImageError(img) {
                        img.src = 'img/placeholder-profile.png';
                    }
                    
                    // Initialize when content is loaded
                    window.addEventListener('DOMContentLoaded', function() {
                        console.log('Print content loaded with font family: ${fontFamily}');
                        
                        // Force font family on body and all elements
                        document.body.style.fontFamily = '${fontFamily}';
                        
                        // Apply font to all elements
                        document.querySelectorAll('*').forEach(el => {
                            if (el.style) {
                                el.style.fontFamily = '${fontFamily}';
                            }
                        });
                        
                        // Fix any broken images
                        document.querySelectorAll('.print-profile-image, .cover-logo').forEach(img => {
                            img.onerror = function() { handleImageError(this); };
                        });
                        
                        // Wait for images to load before printing
                        const checkImages = () => {
                            const images = document.querySelectorAll('img');
                            const totalImages = images.length;
                            let loadedImages = 0;
                            
                            // If no images, proceed to print
                            if (totalImages === 0) {
                                initiatePrint();
                                return;
                            }
                            
                            // Count loaded images
                            images.forEach(img => {
                                if (img.complete) {
                                    loadedImages++;
                                } else {
                                    img.onload = function() {
                                        loadedImages++;
                                        if (loadedImages === totalImages) {
                                            initiatePrint();
                                        }
                                    };
                                    img.onerror = function() {
                                        // Count failed images as loaded
                                        loadedImages++;
                                        if (loadedImages === totalImages) {
                                            initiatePrint();
                                        }
                                    };
                                }
                            });
                            
                            // If all images already loaded
                            if (loadedImages === totalImages) {
                                initiatePrint();
                            }
                        };
                        
                        // Function to safely initiate print
                        function initiatePrint() {
                            if (!printCalled) {
                                printCalled = true;
                                setTimeout(() => {
                                    window.parent.postMessage('printContentReady', '*');
                                }, 300);
                            }
                        }
                        
                        // Start checking images
                        checkImages();
                    });
                </script>
            </head>
            <body style="font-family: ${fontFamily} !important;">
                ${printHTML}
            </body>
            </html>
        `);
        iframeDoc.close();
        
        // Set a timeout in case the message event doesn't fire
        setTimeout(() => {
            if (!printDialogOpened) {
                window.removeEventListener('message', messageListener);
                dismissToast(loadingToastId);
                
                try {
                    iframe.contentWindow.print();
                    showToast('Success', 'Prayer diary generated successfully.', 'success');
                } catch (e) {
                    console.error('Error during fallback print operation:', e);
                    showToast('Error', 'Failed to open print dialog. Please try again.', 'error');
                }
                
                // Remove the iframe
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                    window.isGeneratingPDF = false;
                }, 1000);
            }
        }, 3000);
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        showToast('Error', `Error generating PDF: ${error.message}`, 'error');
        window.isGeneratingPDF = false;
    }
}

// Get prayer cards based on the selected options
async function getPrayerCards() {
    // Wait for auth stability
    await window.waitForAuthStability();
    
    // Get the selected date range
    const dateRange = document.getElementById('print-date-range').value;
    let startDate, endDate;
    
    if (dateRange === 'current-month') {
        // Current month
        const today = new Date();
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (dateRange === 'custom') {
        // Custom date range
        startDate = document.getElementById('print-start-date').valueAsDate;
        endDate = document.getElementById('print-end-date').valueAsDate;
    } else {
        // All prayer cards (no date filtering)
        startDate = null;
        endDate = null;
    }
    
    try {
        console.log("Fetching prayer cards for date range:", 
            startDate ? startDate.toISOString() : "All", 
            endDate ? endDate.toISOString() : "All");
        
        // Get all approved profiles that are assigned to a day
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, profile_image_url, prayer_points, pray_day')
            .eq('approval_state', 'Approved')
            .neq('full_name', 'Super Admin') // Exclude Super Admin
            .gt('pray_day', 0); // Only include profiles assigned to a day
            
        if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
            throw profilesError;
        }
        
        console.log(`Fetched ${profiles.length} profiles assigned to days`);
        
        // Filter profiles based on date range if specified
        let prayerCards = [];
        
        if (dateRange === 'all') {
            // Include all profiles with prayer points that are assigned to a day
            prayerCards = profiles.map(profile => ({
                id: profile.id,
                name: profile.full_name,
                prayerPoints: profile.prayer_points || 'No prayer points provided.',
                profileImage: profile.profile_image_url,
                day: profile.pray_day
            }));
        } else {
            // Filter profiles by day
            // For date range, we want profiles where pray_day falls within the range
            const startDay = startDate ? startDate.getDate() : 1;
            const endDay = endDate ? endDate.getDate() : 31;
            
            console.log(`Filtering for days ${startDay} to ${endDay}`);
            
            // Get profiles with pray_day in the range
            prayerCards = profiles
                .filter(profile => {
                    const day = profile.pray_day || 0;
                    return day >= startDay && day <= endDay;
                })
                .map(profile => ({
                    id: profile.id,
                    name: profile.full_name,
                    prayerPoints: profile.prayer_points || 'No prayer points provided.',
                    profileImage: profile.profile_image_url,
                    day: profile.pray_day
                }));
        }
        
        console.log(`Found ${prayerCards.length} prayer cards after filtering`);
        return prayerCards;
    } catch (error) {
        console.error('Error fetching prayer cards:', error);
        throw error;
    }
}

// Generate the HTML for the printable pages
function generatePrintHTML(prayerCards, includeCover = true) {
    // Sort cards by day if available
    prayerCards.sort((a, b) => {
        if (a.day === null && b.day === null) return 0;
        if (a.day === null) return 1;
        if (b.day === null) return -1;
        return a.day - b.day;
    });
    
    let html = '';
    
    // Current date for footer and cover page
    const today = new Date();
    const dateStr = today.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // Get month name and year for cover page
    const monthName = today.toLocaleString('default', { month: 'long' });
    const year = today.getFullYear();
    
    // FIXED: Add back cover first
    if (includeCover) {
        html += `
        <div class="print-page">
            <div class="back-cover-page">
                <img src="img/logo.png" class="cover-logo" alt="Pelsall Evangelical Church Logo">
            </div>
        </div>
        `;
    }
    
    // FIXED: Add front cover second so it will print correctly
    if (includeCover) {
        html += `
        <div class="print-page">
            <div class="cover-page">
                <h2 class="cover-church-name">Pelsall Evangelical Church</h2>
                <img src="img/logo.png" class="cover-logo" alt="Pelsall Evangelical Church Logo">
                <h1 class="cover-title">Prayer Diary</h1>
                <div class="cover-date">${monthName} ${year}</div>
            </div>
        </div>
        `;
    }
    
    // Group cards by day (exclude unassigned cards)
    const cardsByDay = {};
    prayerCards.forEach(card => {
        if (card.day) { // Only include cards with an assigned day
            const day = card.day;
            if (!cardsByDay[day]) {
                cardsByDay[day] = [];
            }
            cardsByDay[day].push(card);
        }
    });
    
    // Process each day group (sorted numerically)
    Object.keys(cardsByDay)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .forEach(day => {
            const cardsForDay = cardsByDay[day];
            
            // Calculate how many cards can fit on a page
            // We'll try to fit as many as we can while keeping cards for the same day on the same page
            // Increased from 3 to 4 cards per page to maximize space efficiency
            let cardsPerPage = 4;
            
            // Calculate how many pages we need for this day's cards
            const dayPageCount = Math.ceil(cardsForDay.length / cardsPerPage);
            
            // Create pages for this day
            for (let i = 0; i < dayPageCount; i++) {
                // Start a new page
                html += `<div class="print-page">`;
                
                // Add cards to this page
                for (let j = 0; j < cardsPerPage; j++) {
                    const cardIndex = i * cardsPerPage + j;
                    
                    // Break if we've reached the end of the cards for this day
                    if (cardIndex >= cardsForDay.length) break;
                    
                    const card = cardsForDay[cardIndex];
                    
                    // Skip if card doesn't have a name or photo tag
                    if (!card.name) continue;
                    
                    // Default image if none provided
                    const imageUrl = card.profileImage || 'img/placeholder-profile.png';
                    
                    html += `
                        <div class="print-prayer-card">
                            <div class="print-card-body">
                                <div class="print-image-container">
                                    <img src="${imageUrl}" class="print-profile-image" alt="${card.name}" 
                                         onerror="this.onerror=null; this.src='img/placeholder-profile.png';">
                                </div>
                                <div class="print-prayer-points">
                                    <h3 class="print-name">${card.name}</h3>
                                </div>
                            </div>
                        </div>
                    `;
                }
                
                // Add day number in the footer - now larger and bold as per requirements
                html += `
                    <div class="print-footer">
                        Day ${day}
                    </div>
                </div><!-- End of print page -->
                `;
            }
        });
    
    return html;
}