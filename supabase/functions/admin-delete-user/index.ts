// Supabase Edge Function for deleting users (admin function)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';

// CORS headers for browser compatibility
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey, Cache-Control',
  'Access-Control-Max-Age': '86400'
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // Only allow POST for this function
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Parse request body
    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({
        error: 'User ID is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Log environment variables (without sensitive data)
    console.log('Environment check:', {
      supabaseUrl: Deno.env.get('SUPABASE_URL') ? 'Set' : 'Missing',
      serviceRole: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'Set (length: ' + 
                  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.length + ')' : 'Missing',
      anonKey: Deno.env.get('SUPABASE_ANON_KEY') ? 'Set' : 'Missing',
    });

    // Create Supabase admin client using service role key
    // Do NOT use Authorization header - use direct service role instead
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get API key from header for authorization check
    const apikey = req.headers.get('apikey');
    
    // Verify the API key matches the ANON key (simplified auth)
    if (apikey !== Deno.env.get('SUPABASE_ANON_KEY')) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - invalid API key'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Log the operation
    console.log(`Attempting to delete user: ${userId}`);

    // Delete the user using admin API
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      userId
    );

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return new Response(JSON.stringify({
        error: 'Failed to delete user',
        details: deleteError.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      message: 'User deleted successfully'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Server error',
      message: error.message || 'An unknown error occurred'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});
