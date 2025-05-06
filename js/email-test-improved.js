// Improved Email Testing Module with better error handling and timeouts

// Initialize email test view
function initEmailTestView() {
    // Only allow admins to access this feature
    if (!isAdmin()) {
        showNotification('Access Denied', 'You do not have permission to access this feature.');
        showView('calendar-view');
        return;
    }
    
    console.log('Initializing email test view for admin user');
    
    // Set up the form submission
    document.getElementById('test-email-form').addEventListener('submit', sendTestEmail);
    
    // Add bypass button for configuration check
    addBypassButton();
    
    // Check email configuration status with timeout
    checkEmailConfig();
    
    // Current timestamp in the template
    updateEmailTimestamp();
}

// Add a bypass button if the check keeps hanging
function addBypassButton() {
    const statusElement = document.getElementById('email-config-status');
    
    // Check if there's already a bypass button
    if (!document.getElementById('bypass-check-button')) {
        // Create a bypass button that lets users continue even if the check fails
        const bypassButton = document.createElement('button');
        bypassButton.id = 'bypass-check-button';
        bypassButton.className = 'btn btn-sm btn-warning mt-2 d-none';
        bypassButton.innerHTML = '<i class="bi bi-skip-forward"></i> Bypass Check & Continue Anyway';
        bypassButton.onclick = function() {
            statusElement.className = 'alert alert-warning';
            statusElement.innerHTML = `
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                <strong>Check Bypassed!</strong> You've chosen to bypass the configuration check.
                <p class="small mb-0 mt-1">The Edge Function might not be properly configured or deployed. Email sending may still fail.</p>
            `;
        };
        
        statusElement.parentNode.appendChild(bypassButton);
        
        // Show the bypass button after 5 seconds if still checking
        setTimeout(() => {
            if (statusElement.innerHTML.includes('Checking email configuration')) {
                document.getElementById('bypass-check-button').classList.remove('d-none');
            }
        }, 5000);
    }
}

// Update email timestamp in the template
function updateEmailTimestamp() {
    const contentField = document.getElementById('test-email-content');
    const content = contentField.value;
    const timestamp = new Date().toLocaleString();
    const updatedContent = content.replace('${new Date().toLocaleString()}', timestamp);
    contentField.value = updatedContent;
}

// Check if email is configured correctly with timeout
function checkEmailConfig() {
    console.log('Checking email configuration status...');
    const statusElement = document.getElementById('email-config-status');
    
    if (!EMAIL_ENABLED) {
        statusElement.className = 'alert alert-warning';
        statusElement.innerHTML = `
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            <strong>Email is disabled!</strong> Set <code>EMAIL_ENABLED = true</code> in config.js to enable email functionality.
        `;
        return;
    }
    
    // Create a timeout promise
    const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timed out after 10 seconds')), 10000);
    });
    
    // Create the actual function invocation promise
    const functionCall = supabase.functions.invoke('send-email', {
        body: { 
            testConnection: true
        }
    });
    
    // Race the timeout against the actual call
    Promise.race([functionCall, timeout])
        .then(response => {
            console.log('Edge Function response:', response);
            
            if (response.error) {
                statusElement.className = 'alert alert-danger';
                statusElement.innerHTML = `
                    <i class="bi bi-x-circle-fill me-2"></i>
                    <strong>Connection Error!</strong> The Edge Function responded with an error.
                    <p class="mt-2 mb-0 small">Error: ${response.error.message || JSON.stringify(response.error)}</p>
                    <div class="mt-2">
                        <button class="btn btn-sm btn-outline-primary check-deployment-btn">
                            <i class="bi bi-info-circle"></i> Deployment Info
                        </button>
                    </div>
                `;
                
                // Add event listener to the deployment info button
                document.querySelector('.check-deployment-btn').addEventListener('click', showDeploymentInfo);
            } else {
                statusElement.className = 'alert alert-success';
                statusElement.innerHTML = `
                    <i class="bi bi-check-circle-fill me-2"></i>
                    <strong>Email is configured!</strong> You can send test emails.
                `;
                // Hide the bypass button if it exists
                const bypassBtn = document.getElementById('bypass-check-button');
                if (bypassBtn) bypassBtn.classList.add('d-none');
            }
        })
        .catch(error => {
            console.error('Error checking email configuration:', error);
            
            statusElement.className = 'alert alert-danger';
            statusElement.innerHTML = `
                <i class="bi bi-x-circle-fill me-2"></i>
                <strong>Connection Error!</strong> Could not connect to the Edge Function.
                <p class="mt-2 mb-0 small">Error: ${error.message}</p>
                <div class="mt-2">
                    <button class="btn btn-sm btn-outline-primary check-deployment-btn">
                        <i class="bi bi-info-circle"></i> Deployment Info
                    </button>
                </div>
            `;
            
            // Add event listener to the deployment info button
            document.querySelector('.check-deployment-btn').addEventListener('click', showDeploymentInfo);
            
            // Show the bypass button
            const bypassBtn = document.getElementById('bypass-check-button');
            if (bypassBtn) bypassBtn.classList.remove('d-none');
        });
}

// Show deployment information modal
function showDeploymentInfo() {
    console.log('Showing deployment info');
    
    const supabaseUrl = SUPABASE_URL || 'Not configured';
    const functionUrl = `${supabaseUrl}/functions/v1/send-email`;
    
    showNotification(
        'Edge Function Deployment Information',
        `
        <h5 class="mb-3">Troubleshooting Steps</h5>
        <ol class="ps-3">
            <li class="mb-2">
                <strong>Check if the Edge Function is deployed:</strong><br>
                Run <code>supabase functions list</code> in your terminal.
            </li>
            <li class="mb-2">
                <strong>Deploy the Edge Function:</strong><br>
                Run <code>supabase functions deploy send-email</code>
            </li>
            <li class="mb-2">
                <strong>Configure CORS for your domain:</strong><br>
                Run <code>supabase functions update-cors send-email --add-origins="${window.location.origin}"</code>
            </li>
            <li class="mb-2">
                <strong>Allow anonymous invocations (if needed):</strong><br>
                Run <code>supabase functions update-permissions send-email --no-verify-jwt</code>
            </li>
        </ol>
        
        <h5 class="mb-2 mt-4">Function Information</h5>
        <div class="bg-light p-2 rounded mb-3">
            <p class="mb-1"><strong>Function URL:</strong> <code>${functionUrl}</code></p>
            <p class="mb-1"><strong>Your Domain:</strong> <code>${window.location.origin}</code></p>
            <p class="mb-0"><strong>Browser:</strong> <code>${navigator.userAgent}</code></p>
        </div>
        
        <p class="text-muted mb-0">See <code>supabase/functions/send-email/README.md</code> for detailed setup instructions.</p>
        `
    );
}

// Send a test email with improved error handling
async function sendTestEmail(e) {
    e.preventDefault();
    console.log('Sending test email...');
    
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
        console.log(`Preparing to send email to: ${to}`);
        
        // Create a timeout promise
        const timeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timed out after 15 seconds')), 15000);
        });
        
        // Create the email sending promise
        const emailPromise = sendEmail({
            to,
            subject,
            html,
            cc,
            bcc,
            replyTo,
            contentType: 'test_email'
        });
        
        // Race the timeout against the actual email sending
        const result = await Promise.race([emailPromise, timeout]);
        
        console.log('Email sending result:', result);
        
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
                `
                <p>Failed to send test email: ${result.error}</p>
                <div class="mt-3">
                    <button class="btn btn-sm btn-outline-primary check-deployment-btn">
                        <i class="bi bi-info-circle"></i> Show Troubleshooting
                    </button>
                </div>
                `
            );
            
            // Add event listener to the troubleshooting button
            setTimeout(() => {
                const deploymentBtn = document.querySelector('.check-deployment-btn');
                if (deploymentBtn) {
                    deploymentBtn.addEventListener('click', showDeploymentInfo);
                }
            }, 100);
        }
    } catch (error) {
        console.error('Error sending test email:', error);
        
        // Update results container with error
        updateTestResults(to, subject, { success: false, error: error.message });
        
        // Show error notification with troubleshooting option
        showNotification(
            'Email Sending Failed', 
            `
            <p>An error occurred: ${error.message}</p>
            <div class="mt-3">
                <button class="btn btn-sm btn-outline-primary check-deployment-btn">
                    <i class="bi bi-info-circle"></i> Show Troubleshooting
                </button>
            </div>
            `
        );
        
        // Add event listener to the troubleshooting button
        setTimeout(() => {
            const deploymentBtn = document.querySelector('.check-deployment-btn');
            if (deploymentBtn) {
                deploymentBtn.addEventListener('click', showDeploymentInfo);
            }
        }, 100);
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
            <div class="flex-grow-1">
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
