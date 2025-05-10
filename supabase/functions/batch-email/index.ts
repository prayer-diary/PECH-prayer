// Supabase Edge Function for sending batch emails
// This function sends emails in batches of up to 30 recipients (as BCC)
// to avoid SMTP rate limits and protect recipient privacy

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Interface for the email request
interface EmailRequest {
  title: string;
  date: string;
  content: string;
  type: string; // 'update' or 'urgent'
}

// Helper function to pause execution
async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  'Access-Control-Max-Age': '86400'
};

// Serve handles HTTP requests
serve(async (req) => {
  console.log(`[${new Date().toISOString()}] ${req.method} request received`);
  
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS (preflight) request');
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  
  // Only allow POST method
  if (req.method !== 'POST') {
    console.log(`Method ${req.method} not allowed`);
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
  
  try {
    // Create a Supabase client with the provided auth context
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables');
      return new Response(JSON.stringify({
        error: 'Server configuration error',
        message: 'Missing required environment variables'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { 
        headers: { Authorization: req.headers.get('Authorization')! }
      }
    });
    
    // Parse the request body
    let requestData: EmailRequest;
    try {
      requestData = await req.json();
      console.log('Request received:', {
        title: requestData.title,
        type: requestData.type
      });
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return new Response(JSON.stringify({
        error: 'Invalid JSON in request body'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Validate required fields
    if (!requestData.title || !requestData.content || !requestData.type) {
      console.log('Missing required email parameters');
      return new Response(JSON.stringify({
        error: 'Missing required parameters: title, content, type'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
 
      
    // Get approved users who have opted in for email notifications
    const { data: approvedUsers, error: approvedError } = await supabaseClient
      .from('profiles')
      .select('id, full_name, email')
      .eq('approval_state', 'Approved')
      .eq('content_delivery_email', true);
      
    if (approvedError) {
      console.error('Database query error for approved users:', approvedError.message);
      return new Response(JSON.stringify({
        error: 'Failed to fetch approved recipients',
        details: approvedError.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Get email-only users from the email_only_users table
    const { data: emailOnlyUsers, error: emailOnlyError } = await supabaseClient
      .from('email_only_users')
      .select('id, full_name, email')
      .eq('active', true);
      
    if (emailOnlyError) {
      console.error('Database query error for email-only users:', emailOnlyError.message);
      return new Response(JSON.stringify({
        error: 'Failed to fetch email-only recipients',
        details: emailOnlyError.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Combine both sets of users
    const users = [...(approvedUsers || []), ...(emailOnlyUsers || [])];
    
    // Filter out users without email
    const userEmails = users
      .filter(user => user.email)
      .map(user => user.email);
    
    // Log the number of recipients
    console.log(`Found ${userEmails.length} email recipients`);
    
    // If no recipients, just return
    if (userEmails.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No recipients found'
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // The super admin email will always be the primary recipient
    const primaryEmail = 'prayerdiary@pech.co.uk';
    
    // Create HTML content
    const typeLabel = requestData.type === 'update' ? 'Prayer Update' : 'Prayer Request';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #483D8B;">${requestData.title}</h2>
        <p style="color: #666;"><em>${requestData.date}</em></p>
        
        <div style="margin: 20px 0;">
          ${requestData.content}
        </div>
        
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">
          This is an automated message from the Prayer Diary app.
        </p>
      </div>
    `;
    
    // Split recipients into batches of 30
    const batchSize = 30;
    const batches = [];
    for (let i = 0; i < userEmails.length; i += batchSize) {
      batches.push(userEmails.slice(i, i + batchSize));
    }
    
    // Log the number of batches
    console.log(`Will send emails in ${batches.length} batches of up to ${batchSize} recipients`);
    
    // Process batches
    let batchCount = 0;
    let successCount = 0;
    
    for (const batch of batches) {
      batchCount++;
      
      try {
        // Call the send-email function
        const { data, error } = await supabaseClient.functions.invoke('send-email', {
          body: {
            to: primaryEmail,
            bcc: batch.join(','),
            subject: `${typeLabel}: ${requestData.title}`,
            html: htmlContent,
          }
        });
        
        if (error) {
          console.error(`Error in batch ${batchCount}:`, error);
          continue;
        }
        
        // Increment success count
        successCount += batch.length;
        
        // Log success
        console.log(`Batch ${batchCount}: Sent to ${batch.length} recipients`);
        
      } catch (batchError) {
        console.error(`Error in batch ${batchCount}:`, batchError);
      }
      
      // Wait 3 seconds before sending the next batch
      if (batchCount < batches.length) {
        console.log(`Waiting 3 seconds before sending next batch...`);
        await sleep(3000);
      }
    }
    
    // Return success response
    return new Response(JSON.stringify({
      success: true,
      totalRecipients: userEmails.length,
      successfulDeliveries: successCount,
      batches: batchCount
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    // Return error response
    console.error('Batch email error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error'
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      status: 500
    });
  }
});
