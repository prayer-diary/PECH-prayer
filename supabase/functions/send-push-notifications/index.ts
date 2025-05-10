// Supabase Edge Function for sending push notifications
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import * as webpush from 'npm:web-push@3.6.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.29.0';

// Initialize Supabase client with persistSession set to false
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // Disable session persistence to avoid the warning
  }
});

// Set up VAPID keys for Web Push
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:webmaster@pech.co.uk';

// Configure web push with VAPID credentials
webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

// CORS headers for the response - expanded to include x-client-info
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // In production, consider limiting to 'https://prayer.pech.co.uk'
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-client-info, apikey, X-Client-Info',
  'Access-Control-Max-Age': '86400',
};

// Logging utility for debugging
const logDebug = (message: string, data?: any) => {
  console.log(`[PUSH-DEBUG] ${message}`, data ? JSON.stringify(data) : '');
};

// Get the view ID for navigation based on content type
function getViewIdFromContentType(contentType: string | null): string {
  if (!contentType) return 'calendar-view'; // Default view
  
  switch(contentType.toLowerCase()) {
    case 'prayer_update':
    case 'update':
      return 'updates-view';
    case 'urgent_prayer':
    case 'urgent':
      return 'urgent-view';
    default:
      return 'calendar-view';
  }
}

// Generate a hash-based navigation URL
function getNavigationUrl(contentType: string | null, contentId: string | null): string {
  // Get view name without -view suffix
  const viewName = getViewIdFromContentType(contentType).replace('-view', '');
  
  // Create hash URL
  let hashUrl = `/#${viewName}`;
  
  // Add content ID if available
  if (contentId) {
    hashUrl += `/content/${contentId}`;
  }
  
  return hashUrl;
}

// Handle HTTP requests to the function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204, // No content
      headers: corsHeaders,
    });
  }
  
  // Only allow POST requests for actual function
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }

  try {
    // Parse the request body
    const { userIds, title, message, contentType, contentId, data, ...otherOptions } = await req.json();
    
    // Validate inputs
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid userIds parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    logDebug(`Notification request received for users: ${userIds.join(', ')}`, {
      contentType,
      title
    });

    // Get active subscriptions for the specified users
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, subscription_data, platform, active')
      .in('user_id', userIds)
      .eq('active', true);
    
    if (error) {
      logDebug('Error fetching subscriptions', error);
      return new Response(
        JSON.stringify({ error: `Database error: ${error.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    if (!subscriptions || subscriptions.length === 0) {
      logDebug('No active subscriptions found for users');
      return new Response(
        JSON.stringify({ message: 'No active subscriptions found for the specified users' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    logDebug(`Found ${subscriptions.length} subscriptions`);
    
    // Get view ID for navigation based on content type
    const viewId = getViewIdFromContentType(contentType);
    
    // Get hash-based navigation URL
    const hashUrl = getNavigationUrl(contentType, contentId);
    
    // Process each subscription and send notifications
    const results = await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          const subscriptionData = subscription.subscription_data;
          const platform = subscription.platform || 'other';
          
          // Skip invalid subscription data
          if (!subscriptionData || !subscriptionData.endpoint) {
            return {
              success: false,
              userId: subscription.user_id,
              error: 'Invalid subscription data',
              platform
            };
          }
          
          // Log subscription info for debugging
          logDebug(`Processing subscription for user ${subscription.user_id}`, {
            platform,
            endpoint: subscriptionData.endpoint.substring(0, 30) + '...'
          });
          
          // Base notification payload (common for all platforms)
          const basePayload = {
            title: title || 'Prayer Diary',
            body: message || 'New prayer notification',
            icon: '/img/icons/ios/192.png',
            badge: '/img/icons/ios/72.png',
            data: {
              contentType: contentType || 'default',
              contentId: contentId || null,
              viewId: viewId, // Include the viewId for direct navigation
              timestamp: Date.now(),
              // Use hash-based navigation
              url: hashUrl,
              ...data
            },
            ...otherOptions
          };
          
          // Platform-specific notification payload enhancements
          let platformPayload;
          
          if (platform === 'android') {
            // Android-specific enhancements
            platformPayload = {
              ...basePayload,
              // Set icon to the Android-specific notification icon
              badge: '/img/icons/android/notification_icon.png',  // Use the white silhouette icon
              // Android requires these for optimal visibility - updated to max priority
              priority: 'max',
              // Enhanced vibration pattern for stronger alerts
              vibrate: [200, 100, 200, 100, 200, 100, 400],
              requireInteraction: true,
              // Unique tag with timestamp for each notification
              tag: `prayer-diary-${contentType || 'notification'}-${Date.now()}`,
              renotify: true,
              //actions: [
              //  { action: 'open', title: 'View' },
              //  { action: 'dismiss', title: 'Dismiss' }
              //],
              // Android needs more detailed messages
              body: message || `New ${contentType || 'prayer'} notification. Tap to view details.`,
              // Ensure timestamp is present for proper ordering
              timestamp: Date.now(),
              // Set silent to false explicitly to ensure notification alert
              silent: false,
              // Add sound for better alerts
              sound: 'default',
              // Add explicit importance setting for heads-up display
              importance: 'high',
              // Set maximum visibility for lock screen
              visibility: 'public'
            };
          } else if (platform === 'ios') {
            // iOS-specific enhancements
            platformPayload = {
              ...basePayload,
              // iOS-specific settings
              requireInteraction: true,
              // iOS handles actions differently
              actions: [
                { action: 'view', title: 'View' }
              ]
            };
          } else {
            // Default payload for unknown platforms
            platformPayload = basePayload;
          }
          
          // Web Push specific options
          const pushOptions = {
            TTL: 60 * 60 * 24, // 24 hours (in seconds)
            urgency: platform === 'android' ? 'high' : 'normal',
            topic: contentType || 'prayer' // For grouping notifications
          };
          
          // Send the notification
          await webpush.sendNotification(
            subscriptionData,
            JSON.stringify(platformPayload),
            pushOptions
          );
          
          // Log success
          logDebug(`Successfully sent notification to user ${subscription.user_id} on ${platform}`);
          
          return {
            success: true,
            userId: subscription.user_id,
            platform
          };
        } catch (error) {
          // Handle expired subscriptions
          if (error.statusCode === 410) { // Gone - subscription has expired
            logDebug(`Subscription expired for user ${subscription.user_id}, marking as inactive`);
            
            // Mark subscription as inactive
            try {
              await supabase
                .from('push_subscriptions')
                .update({ active: false })
                .eq('id', subscription.id);
            } catch (dbError) {
              logDebug(`Failed to mark subscription as inactive: ${dbError.message}`);
            }
          }
          
          // Log the error
          logDebug(`Error sending notification to user ${subscription.user_id}:`, {
            error: error.message,
            statusCode: error.statusCode,
            platform: subscription.platform
          });
          
          return {
            success: false,
            userId: subscription.user_id,
            error: `${error.message} (${error.statusCode || 'unknown'})`,
            platform: subscription.platform
          };
        }
      })
    );
    
    // Calculate success/failure statistics
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    // Log summary
    logDebug(`Notification sending complete. Successful: ${successful}, Failed: ${failed}`);
    
    // Return results with CORS headers
    return new Response(
      JSON.stringify({
        success: true,
        total: results.length,
        sent: successful,
        failed: failed,
        results
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        } 
      }
    );
  } catch (error) {
    // Handle unexpected errors
    logDebug(`Unexpected error: ${error.message}`);
    
    return new Response(
      JSON.stringify({ error: `Error: ${error.message}` }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        } 
      }
    );
  }
});