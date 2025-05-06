// Supabase Edge Function: send-push-notifications
// Sends push notifications to users who have subscribed

import { serve } from 'https://deno.land/std@0.170.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import webpush from 'npm:web-push@3.5.0'
// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  'Access-Control-Max-Age': '86400'
};

// Setup web-push with VAPID keys
// IMPORTANT: In production, store these in secure environment variables
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || 'YOUR_VAPID_PUBLIC_KEY_HERE';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || 'YOUR_VAPID_PRIVATE_KEY_HERE';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:your-email@example.com';

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    // Get request body
    const { userIds, title, message, contentType, contentId, data } = await req.json()

    // Verify required parameters
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('Missing or invalid userIds parameter')
    }
    if (!title || !message) {
      throw new Error('Missing required parameters: title and message are required')
    }

    // Initialize Supabase client with admin privileges
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Fetch push subscriptions for the specified users
    // Note: We're not filtering by active here in case the column doesn't exist yet
    const { data: subscriptions, error: fetchError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds)

    if (fetchError) {
      throw new Error(`Error fetching subscriptions: ${fetchError.message}`)
    }

    console.log(`Found ${subscriptions?.length || 0} active push subscriptions for ${userIds.length} users`)

    // If no subscriptions found, return early
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active push subscriptions found for the specified users',
          sent: 0
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      )
    }

    // Get the base URL from environment variable or use the GitHub Pages URL as default
    const BASE_URL = Deno.env.get('APP_URL') || 'https://prayer-diary.github.io/PECH-prayer';

    // Prepare notification payload with absolute URLs for icons
    const notificationPayload = JSON.stringify({
      title: title,
      body: message,
      icon: `${BASE_URL}/img/icons/android/android-launchericon-192-192.png`,
      badge: `${BASE_URL}/img/icons/android/android-launchericon-72-72.png`,
      image: data?.image || null,  // Optional larger image to show in notification
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1,
        url: data?.url || '/',
        contentType,
        contentId
      },
      // Visual options to improve notification appearance
      vibrate: [100, 50, 100],
      requireInteraction: true,  // Keep notification visible until dismissed
      actions: [
        {
          action: 'view',
          title: 'View'
        }
      ]
    })

    // Send push notifications and track results
    const results = []
    let successCount = 0
    let failureCount = 0

    // Filter subscriptions manually to handle missing active column
    const activeSubscriptions = subscriptions.filter(sub => 
      // Consider subscription active if active property is undefined or true
      sub.active === undefined || sub.active === true
    );
    
    console.log(`Found ${activeSubscriptions.length} active subscriptions after filtering`);
    
    for (const subscription of activeSubscriptions) {
      try {
        // FIXED: Use subscription_data instead of subscription_object
        // Skip if subscription data is missing or invalid
        if (!subscription.subscription_data || !subscription.subscription_data.endpoint) {
          console.log(`Skipping invalid subscription for user ${subscription.user_id}`)
          continue
        }

        // Send the notification with the correct field name and TTL
        await webpush.sendNotification(
          subscription.subscription_data,  // Using subscription_data field
          notificationPayload,
          {
            // Add TTL of 24 hours (in seconds) to ensure notifications don't expire too quickly
            TTL: 86400
          }
        )

        // Record successful delivery
        successCount++
        results.push({
          user_id: subscription.user_id,
          success: true
        })

        // Log the notification in the database
        await supabaseAdmin
          .from('notification_logs')
          .insert({
            user_id: subscription.user_id,
            notification_type: 'push',
            content_type: contentType,
            content_id: contentId,
            status: 'sent'
          })

      } catch (error) {
        // This could be due to an expired subscription
        failureCount++
        console.error(`Error sending notification to subscription ${subscription.id}:`, error)
        
        results.push({
          user_id: subscription.user_id,
          success: false,
          error: error.message
        })

        // Handle specific webpush errors
        if (error.statusCode === 404 || error.statusCode === 410) {
          // Subscription has expired or is no longer valid
          console.log(`Subscription ${subscription.id} is no longer valid, marking as inactive`)
          
          try {
            // Mark subscription as inactive
            await supabaseAdmin
              .from('push_subscriptions')
              .update({ active: false })
              .eq('id', subscription.id)
          } catch (updateError) {
            // Handle case where active column doesn't exist yet
            console.log(`Could not mark subscription as inactive: ${updateError.message}`)
          }
        }

        // Log the failure in the database
        await supabaseAdmin
          .from('notification_logs')
          .insert({
            user_id: subscription.user_id,
            notification_type: 'push',
            content_type: contentType,
            content_id: contentId,
            status: 'failed',
            error_message: error.message
          })
      }
    }

    // Return the results
    return new Response(
      JSON.stringify({
        success: true,
        message: `Push notifications sent to ${successCount} subscriptions (${failureCount} failures)`,
        sent: successCount,
        failed: failureCount,
        results
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    )
  } catch (error) {
    // Handle and return any errors
    console.error('Error in send-push-notifications function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    )
  }
})