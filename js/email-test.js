// Email Testing Module

// Initialize email test view
function initEmailTestView() {
    // Only allow admins to access this feature
    if (!isAdmin()) {
        showNotification('Access Denied', 'You do not have permission to access this feature.');
        showView('calendar-view');
        return;
    }
    
    // Set up the form submission
    document.getElementById('test-email-form').addEventListener('submit', sendTestEmail);
    
    // Check email configuration status
    checkEmailConfig();
    
    // Current timestamp in the template
    updateEmailTimestamp();
}

// Update email timestamp in the template
function updateEmailTimestamp() {
    const contentField = document.getElementById('test-email-content');
    const content = contentField.value;
    const timestamp = new Date().toLocaleString();
    const updatedContent = content.replace('${new Date().toLocaleString()}', timestamp);
    contentField.value = updatedContent;
}

// Check if email is configured correctly
function checkEmailConfig() {
    const statusElement = document.getElementById('email-config-status');
    
    if (!EMAIL_ENABLED) {
        statusElement.className = 'alert alert-warning';
        statusElement.innerHTML = `
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            <strong>Email is disabled!</strong> Set <code>EMAIL_ENABLED = true</code> in config.js to enable email functionality.
        `;
        return;
    }
    
    // Test if the Supabase function is deployed
    supabase.functions.invoke('send-email', {
        body: { 
            testConnection: true
        }
    }).then(response => {
        if (response.error) {
            statusElement.className = 'alert alert-danger';
            statusElement.innerHTML = `
                <i class="bi bi-x-circle-fill me-2"></i>
                <strong>Connection Error!</strong> The Edge Function might not be deployed or configured correctly.
                <p class="mt-2 mb-0 small">Error: ${response.error.message}</p>
            `;
        } else {
            statusElement.className = 'alert alert-success';
            statusElement.innerHTML = `
                <i class="bi bi-check-circle-fill me-2"></i>
                <strong>Email is configured!</strong> You can send test emails.
            `;
        }
    }).catch(error => {
        statusElement.className = 'alert alert-danger';
        statusElement.innerHTML = `
            <i class="bi bi-x-circle-fill me-2"></i>
            <strong>Connection Error!</strong> Could not connect to the Edge Function.
            <p class="mt-2 mb-0 small">Error: ${error.message}</p>
        `;
    });
}

// Send a test email
async function sendTestEmail(e) {
    e.preventDefault();
    
    // Get form values
    const to = document.getElementById('test-email-to').value;
    const subject = document.getElementById('test-email-subject').value;
    const html = document.getElementById('test-email-content').value;
    const cc = document.getElementById('test-email-cc').value || null;
    const bcc = document.getElementById('test-email-bcc').value || null;
    const replyTo = document.getElementById('test-email-reply-to').value || null;
    
    // Show loading state
    const submitBtn = document.getElementById('send-test-email-btn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Sending...';
    submitBtn.disabled = true;
    
    try {
        // Send the email using our general purpose email function
        const result = await sendEmail({
            to,
            subject,
            html,
            cc,
            bcc,
            replyTo
        });
        
        // Update results container
        updateTestResults(to, subject, result);
        
        // Show success notification
        if (result.success) {
            showNotification(
                'Email Sent Successfully', 
                `Test email has been sent to <strong>${to}</strong>. Please check the inbox (and spam folder) to confirm delivery.`
            );
        } else {
            showNotification(
                'Email Sending Failed', 
                `Failed to send test email: ${result.error}`
            );
        }
    } catch (error) {
        console.error('Error sending test email:', error);
        
        // Update results container with error
        updateTestResults(to, subject, { success: false, error: error.message });
        
        // Show error notification
        showNotification(
            'Email Sending Failed', 
            `An error occurred: ${error.message}`
        );
    } finally {
        // Restore button state
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    }
}

// Update the test results container
function updateTestResults(to, subject, result) {
    const container = document.getElementById('test-results-container');
    const timestamp = new Date().toLocaleString();
    
    // Create a new result card
    const card = document.createElement('div');
    card.className = `alert ${result.success ? 'alert-success' : 'alert-danger'} mb-3`;
    
    card.innerHTML = `
        <div class="d-flex">
            <div class="me-3">
                <i class="bi ${result.success ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} fs-4"></i>
            </div>
            <div>
                <div class="fw-bold">${result.success ? 'Success' : 'Failed'}: ${subject}</div>
                <div>To: ${to}</div>
                <div class="small text-muted">${timestamp}</div>
                ${!result.success ? `<div class="small text-danger mt-1">Error: ${result.error}</div>` : ''}
            </div>
        </div>
    `;
    
    // Add the new result at the top
    if (container.firstChild) {
        container.insertBefore(card, container.firstChild);
    } else {
        container.innerHTML = '';
        container.appendChild(card);
    }
    
    // Limit to 5 most recent results
    const results = container.querySelectorAll('.alert');
    if (results.length > 5) {
        for (let i = 5; i < results.length; i++) {
            container.removeChild(results[i]);
        }
    }
}