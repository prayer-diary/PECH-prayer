// Supabase Edge Function: register-email-user
// Creates an email-only user entry in a separate table (no auth)

import { serve } from 'https://deno.land/std@0.170.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  'Access-Control-Max-Age': '86400'
};

// Interface for the registration request
interface EmailUserRequest {
  full_name: string;
  email: string;
}

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

    // Initialize Supabase client with admin privileges (service role key)
    // This bypasses RLS policies
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

    // Get the current user's session to verify they're an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    // Extract the JWT token
    const token = authHeader.replace('Bearer ', '')
    
    // Verify the user's session
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      throw new Error('Invalid user session')
    }

    // Check if the user is an admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('User profile not found')
    }

    if (profile.user_role !== 'Administrator') {
      throw new Error('Only administrators can register email-only users')
    }

    // Parse the request body
    const { full_name, email }: EmailUserRequest = await req.json()

    // Validate required fields
    if (!full_name || !email) {
      throw new Error('Missing required parameters: full_name and email are required')
    }

    // Check if email already exists in the email_only_users table
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('email_only_users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking for existing email-only user:', checkError)
    }
    
    // Check if email already exists in the profiles table with any status
    const { data: existingProfileUser, error: checkProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, approval_state')
      .eq('email', email)
      .maybeSingle()

    if (checkProfileError) {
      console.error('Error checking for existing profile user:', checkProfileError)
    }

    // If a user with this email already exists in profiles, return an error
    if (existingProfileUser) {
      const status = existingProfileUser.approval_state || 'registered';
      return new Response(
        JSON.stringify({
          success: false,
          error: `This email is already registered as a ${status.toLowerCase()} user: ${existingProfileUser.full_name}`,
          existingUser: {
            id: existingProfileUser.id,
            fullName: existingProfileUser.full_name,
            status: status
          }
        }),
        {
          status: 200, // Return a 200 so client can parse error message
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      )
    }

    let userId, data, error

    if (existingUser) {
      // Email already exists, update the record
      console.log('Email-only user already exists, updating record')
      userId = existingUser.id
      
      const updateResult = await supabaseAdmin
        .from('email_only_users')
        .update({
          full_name: full_name,
          active: true,
        })
        .eq('id', userId)
        .select()

      data = updateResult.data
      error = updateResult.error
    } else {
      // Create a new email-only user
      console.log('Creating new email-only user')
      const insertResult = await supabaseAdmin
        .from('email_only_users')
        .insert({
          full_name: full_name,
          email: email,
          active: true
        })
        .select()

      data = insertResult.data
      error = insertResult.error
    }

    if (error) {
      throw new Error(`Failed to create/update email-only user: ${error.message}`)
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: `Email-only user '${full_name}' registered successfully`,
        userId: userId || (data && data[0]?.id)
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
    // Return error response
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
