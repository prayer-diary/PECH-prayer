// Supabase Edge Function: get-vapid-key
// Returns the VAPID public key for push notifications

import { serve } from 'https://deno.land/std@0.170.0/http/server.ts'

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',  // Added POST to allowed methods
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  'Access-Control-Max-Age': '86400'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Allow both GET and POST requests
    if (req.method !== 'GET' && req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    // Get the VAPID public key from environment variable
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')

    // Check if the key exists
    if (!vapidPublicKey) {
      throw new Error('VAPID public key not configured')
    }

    // Return the public key
    return new Response(
      JSON.stringify({
        success: true,
        vapidPublicKey: vapidPublicKey
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
    console.error('Error retrieving VAPID key:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: error.message === 'VAPID public key not configured' ? 500 : 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    )
  }
})