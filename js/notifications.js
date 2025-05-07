// Notifications Module

// Send a notification of the specified type to eligible users
// Valid types are 'prayer_update' and 'urgent_prayer'
async function sendNotification(type, title, content, date, notificationMethods = []) {
    try {
        // Validate type parameter
        if (type !== 'prayer_update' && type !== 'urgent_prayer') {
            console.error(`Invalid notification type: ${type}. Must be 'prayer_update' or 'urgent_prayer'`);
            return false;
        }
        
        // Log the notification
        console.log(`Sending ${type} notification: ${title}`);
        console.log('Notification methods:', notificationMethods);
        
        // If no methods specified, use all available methods
        const useAllMethods = notificationMethods.length === 0 || typeof notificationMethods === 'string';
        
        // Depending on which notification services are enabled, send notifications
        if (EMAIL_ENABLED && (useAllMethods || notificationMethods.includes('email'))) {
            await sendEmailNotifications(type, title, content, date);
        }
        
        // SMS notifications
        if (TWILIO_ENABLED && (useAllMethods || notificationMethods.includes('sms'))) {
            await sendSmsNotifications(type, title, content, date);
        }
            
        // WhatsApp notifications - uses separate config flag
        if (WHATSAPP_ENABLED && (useAllMethods || notificationMethods.includes('whatsapp'))) {
            await sendWhatsAppNotifications(type, title, content, date);
        }
        
        // Push notifications
        if (PUSH_NOTIFICATION_ENABLED && (useAllMethods || notificationMethods.includes('push'))) {
            await sendPushNotifications(type, title, content, date);
        }
        
        return true;
    } catch (error) {
        console.error('Error sending notifications:', error);
        return false;
    }
}

// Send email notifications for the specified type
async function sendEmailNotifications(type, title, content, date) {
    await window.waitForAuthStability();
    try {
        // Get approved users who have opted in for email notifications
        const { data: approvedUsers, error: approvedError } = await supabase
            .from('profiles')
            .select(`
                id,
                full_name,
                email
            `)
            .eq('approval_state', 'Approved')
            .eq('content_delivery_email', true);
            
        if (approvedError) {
            console.error('Error fetching approved users:', approvedError);
            throw approvedError;
        }
        
        // Get email-only users from the email_only_users table
        const { data: emailOnlyUsers, error: emailOnlyError } = await supabase
            .from('email_only_users')
            .select(`
                id,
                full_name,
                email
            `)
            .eq('active', true);
            
        if (emailOnlyError) {
            console.error('Error fetching email-only users:', emailOnlyError);
            throw emailOnlyError;
        }
        
        // Combine both sets of users
        const users = [...(approvedUsers || []), ...(emailOnlyUsers || [])];
        
        // Log the number of recipients
        console.log(`Sending email notifications to ${users.length} recipients`);
        
        // For each user, send an email notification
        // In a real implementation, we would use a service like SendGrid, AWS SES, etc.
        for (const user of users) {
            const email = user.email;
            
            if (email) {
                // Log notification
                await logNotification(user.id, 'email', type, 'sent');
                
                // In a real implementation, we would call an email service API here
                console.log(`[EMAIL] To: ${email}, Subject: Prayer Diary - ${title}`);
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error sending email notifications:', error);
        return false;
    }
}

// Send SMS notifications for the specified type
async function sendSmsNotifications(type, title, content, date) {
    await window.waitForAuthStability();
    try {
        // Get users who have opted in for SMS notifications using the new notification_method field
        const { data: users, error } = await supabase
            .from('profiles')
            .select(`
                id,
                full_name,
                phone_number
            `)
            .eq('approval_state', 'Approved')
            .eq('notification_method', 'sms')
            .not('phone_number', 'is', null);
            
        if (error) throw error;
        
        // Log the number of recipients
        console.log(`Sending SMS notifications to ${users.length} recipients`);
        
        if (users.length > 0) {
            // Prepare the message - keep it short for SMS
            const messageType = type === 'prayer_update' ? 'Prayer Update' : 'Urgent Prayer';
            const message = `PECH Prayer: New ${messageType} - ${title}. Please check the app for details.`;
            
            // Collect all phone numbers
            const phoneNumbers = users.map(user => user.phone_number).filter(Boolean);
            
            if (phoneNumbers.length > 0) {
                // Call the ClickSend Edge Function to send SMS notifications
                const result = await sendClickSendSMS(phoneNumbers, message);
                
                if (result.success) {
                    console.log(`Successfully sent SMS notifications via ClickSend to ${phoneNumbers.length} recipients`);
                    
                    // Log notifications for each user
                    for (const user of users) {
                        if (user.phone_number) {
                            await logNotification(user.id, 'sms', type, 'sent');
                        }
                    }
                    
                    return true;
                } else {
                    console.error('Error from ClickSend SMS service:', result.error);
                    return false;
                }
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error sending SMS notifications:', error);
        return false;
    }
}

// Send WhatsApp notifications for the specified type
async function sendWhatsAppNotifications(type, title, content, date) {
    await window.waitForAuthStability();
    try {
        // Get users who have opted in for WhatsApp notifications using the new notification_method field
        const { data: users, error } = await supabase
            .from('profiles')
            .select(`
                id,
                full_name,
                whatsapp_number
            `)
            .eq('approval_state', 'Approved')
            .eq('notification_method', 'whatsapp')
            .not('whatsapp_number', 'is', null);
            
        if (error) throw error;
        
        // Log the number of recipients
        console.log(`Sending WhatsApp notifications to ${users.length} recipients`);
        
        // Choose the correct template based on notification type
        const templateName = type === 'prayer_update' ? 'prayer_update_notify' : 'urgent_prayer_notify';
        console.log(`[WhatsApp] Using template: ${templateName} for notification type: ${type}`);
        
        // Process each user with a valid WhatsApp number
        for (const user of users) {
            if (user.whatsapp_number) {
                try {
                    // Format phone number if needed - ensure it includes country code
                    let phoneNumber = user.whatsapp_number;
                    
                    // Ensure phone number has the right format for WhatsApp (starts with country code without +)
                    if (phoneNumber.startsWith('+')) {
                        phoneNumber = phoneNumber.substring(1); // Remove + if present
                    } else if (phoneNumber.startsWith('0')) {
                        // If UK number starting with 0, replace with 44
                        phoneNumber = '44' + phoneNumber.substring(1);
                    }
                    
                    console.log(`[WhatsApp] Sending to ${user.full_name} at ${phoneNumber} using template: ${templateName}`);
                    
                    // Call the send-whatsapp Edge Function to send template message
                    const response = await supabase.functions.invoke('send-whatsapp', {
                        body: {
                            phoneNumber: phoneNumber,
                            templateName: templateName,
                            templateParams: [
                                {
                                    type: "body",
                                    parameters: [
                                        {
                                            type: "text",
                                            text: title
                                        }
                                    ]
                                }
                            ]
                        }
                    });
                    
                    // Log success or errors from the response
                    if (response.error) {
                        console.error(`[WhatsApp] Edge function error:`, response.error);
                        await logNotification(user.id, 'whatsapp', type, 'failed', response.error.message || 'Edge function error');
                    } else {
                        // Log notification success
                        await logNotification(user.id, 'whatsapp', type, 'sent');
                        console.log(`[WhatsApp] Template ${templateName} sent successfully to: ${phoneNumber}`);
                    }
                } catch (whatsappError) {
                    console.error(`[WhatsApp] Error sending to ${user.whatsapp_number}:`, whatsappError);
                    await logNotification(user.id, 'whatsapp', type, 'failed', whatsappError.message);
                }
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error sending WhatsApp notifications:', error);
        return false;
    }
}



// Send a welcome email to a newly approved user
async function sendWelcomeEmail(email, name, userId = null) {
    try {
        // Create HTML email content
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #483D8B;">Welcome to Prayer Diary!</h2>
                <p>Dear ${name},</p>
                
                <p>Your Prayer Diary account has been approved. You can now log in and use all features of the app.</p>
                
                <p>Thank you for being part of our prayer community!</p>
                
                <div style="margin: 25px 0;">
                    <a href="${window.location.origin}" 
                    style="background-color: #483D8B; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                        Open Prayer Diary
                    </a>
                </div>
                
                <p>Blessings,<br>The Prayer Diary Team</p>
            </div>
        `;
        
        // Send email using our general email function
        const result = await sendEmail({
            to: email,
            subject: 'Welcome to Prayer Diary - Your Account is Approved',
            html: htmlContent
            // Notification logging parameters removed
        });
        
        return result.success;
    } catch (error) {
        console.error('Error sending welcome email:', error);
        return false;
    }
}

// Log a notification in the database - disabled to avoid DB issues
async function logNotification(userId, notificationType, contentType, status, errorMessage = null) {
    // Function has been disabled - notification logging removed
    console.log(`Notification would have been logged: ${notificationType} for user ${userId}`);
    return true;
}

// Implementation of email sending via Supabase Edge Function with Google SMTP
// This is a general purpose function that can be used throughout the app
async function sendEmail(options) {
    await window.waitForAuthStability();
    // Set default values if not provided
    const {
        to,                    // Recipient email (required)
        subject,               // Email subject (required)
        html,                  // HTML content (required)
        text = null,           // Plain text fallback (optional)
        cc = null,             // CC recipients (optional)
        bcc = null,            // BCC recipients (optional)
        replyTo = null,        // Reply-To address (optional)
        from = null            // Sender address override (optional) - if not provided, will use default in Edge function
    } = options;

    // Validate required fields
    if (!to || !subject || !html) {
        console.error('Missing required email parameters');
        return { success: false, error: 'Missing required email parameters' };
    }

    // Check if email is enabled in config
    if (!EMAIL_ENABLED) {
        console.log(`Email disabled. Would have sent email to ${to}`);
        return { success: false, error: 'Email is not enabled' };
    }
    
    try {
        // Debug the request body before sending
        const requestBody = {
            to: to,
            subject: subject,
            html: html,
            text: text || html.replace(/<[^>]*>/g, ''), // Fallback plain text
        };
        
        // Only add optional parameters if they exist - prevents sending null values
        if (cc) requestBody.cc = cc;
        if (bcc) requestBody.bcc = bcc;
        if (replyTo) requestBody.replyTo = replyTo;
        if (from) requestBody.from = from;
        
        console.log("Sending email with body:", JSON.stringify(requestBody).substring(0, 100) + '...');
        
        // Add a 3-second delay to prevent SMTP rate limiting issues
        console.log(`Adding 3-second delay before sending email to ${to} to prevent SMTP rate limiting...`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay
        
        // Call the Supabase Edge Function with the properly structured request
        const { data, error } = await supabase.functions.invoke('send-email', {
            body: requestBody
        });
        
        if (error) {
            console.error('Edge function error details:', error);
            throw error;
        }
        
        // Log successful email delivery
        console.log('Email sent successfully to:', to);
        
        return { success: true, data };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
}

// Implementation of SMS sending via ClickSend API through Supabase Edge Function
async function sendClickSendSMS(phoneNumbers, message) {
    await window.waitForAuthStability();
    
    // Validate inputs
    if (!phoneNumbers || phoneNumbers.length === 0 || !message) {
        console.error('Missing required SMS parameters');
        return { success: false, error: 'Missing required SMS parameters' };
    }

    // Check if SMS is enabled in config
    if (!TWILIO_ENABLED) {
        console.log(`SMS disabled. Would have sent SMS to ${phoneNumbers.length} recipients`);
        return { success: false, error: 'SMS notification is not enabled' };
    }
    
    try {
        console.log("Preparing to send SMS notifications via ClickSend...");
        
        // Prepare the request body for the Edge Function
        const requestBody = {
            recipients: phoneNumbers,
            message: message
        };
        
        // Call the Supabase Edge Function
        const { data, error } = await supabase.functions.invoke('send-sms', {
            body: requestBody
        });
        
        if (error) {
            console.error('Edge function error details:', error);
            throw error;
        }
        
        // Log successful SMS delivery
        console.log('SMS sent successfully to:', phoneNumbers.length, 'recipients');
        
        return { success: true, data };
    } catch (error) {
        console.error('Error sending SMS via ClickSend:', error);
        return { success: false, error: error.message };
    }
}


// Implementation of WhatsApp sending via Meta Business WhatsApp API
async function sendWhatsApp(to, templateName, titleParam = '') {
    try {
        // Validate input
        if (!to || !templateName) {
            console.error('Missing required WhatsApp parameters');
            return { success: false, error: 'Missing required WhatsApp parameters' };
        }

        // Format phone number
        let phoneNumber = to;
        if (phoneNumber.startsWith('+')) {
            phoneNumber = phoneNumber.substring(1); // Remove + if present
        } else if (phoneNumber.startsWith('0')) {
            // If UK number starting with 0, replace with 44
            phoneNumber = '44' + phoneNumber.substring(1);
        }
        
        console.log(`[WhatsApp] Sending template ${templateName} to ${phoneNumber}`);
        
        // Create template parameters structure
        const templateParams = [
            {
                type: "body",
                parameters: [
                    {
                        type: "text",
                        text: titleParam || 'Prayer Diary Notification'
                    }
                ]
            }
        ];
        
        // Call the send-whatsapp Edge Function
        const { data, error } = await supabase.functions.invoke('send-whatsapp', {
            body: {
                phoneNumber: phoneNumber,
                templateName: templateName,
                templateParams: templateParams
            }
        });
        
        if (error) {
            console.error('[WhatsApp] Error calling WhatsApp edge function:', error);
            return { success: false, error: error.message };
        }
        
        console.log('[WhatsApp] Message sent successfully');
        return { success: true, data };
    } catch (error) {
        console.error('[WhatsApp] Error sending WhatsApp message:', error);
        return { success: false, error: error.message };
    }
}

// Update the sendPushNotifications function in notifications.js to use the correct URL format

async function sendPushNotifications(type, title, content, date) {
    await window.waitForAuthStability();
    try {
        // Get users who have opted in for Push notifications using the notification_method field
        const { data: users, error } = await supabase
            .from('profiles')
            .select(`
                id,
                full_name
            `)
            .eq('approval_state', 'Approved')
            .eq('notification_method', 'push');
            
        if (error) throw error;
        
        // Log the number of recipients
        console.log(`Sending Push notifications to ${users.length} recipients`);
        
        if (users.length > 0) {
            // Prepare the message for push notification
            const messageType = type === 'prayer_update' ? 'Prayer Update' : 'Urgent Prayer';
            const message = `${messageType} - ${title}`;
            
            // Collect all user IDs
            const userIds = users.map(user => user.id).filter(Boolean);
            
            if (userIds.length > 0) {
                // Determine the correct view ID based on notification type
                const viewId = type === 'prayer_update' ? 'updates-view' : 'urgent-view';
                
                // Call the Push Notification Edge Function
                const result = await supabase.functions.invoke('send-push-notifications', {
                    body: {
                        userIds: userIds,
                        title: messageType,
                        message: message,
                        contentType: type,
                        contentId: null, // This would be the ID of the prayer update or urgent prayer
                        data: {
                            // Use the viewId directly for more reliable navigation
                            url: viewId 
                        }
                    }
                });
                
                if (result.error) {
                    console.error('Error from Push Notification service:', result.error);
                    return false;
                }
                
                console.log(`Successfully sent Push notifications to ${userIds.length} recipients`);
                
                // Log notifications for each user
                for (const user of users) {
                    await logNotification(user.id, 'push', type, 'sent');
                }
                
                return true;
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error sending Push notifications:', error);
        return false;
    }
}