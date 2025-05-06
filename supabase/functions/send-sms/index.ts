// Supabase Edge Function for sending SMS notifications via ClickSend API
// To deploy this function to Supabase, you would run:
// supabase functions deploy send-sms

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Types
interface SmsRequestBody {
  recipients: string[];
  message: string;
}

interface SmsMessage {
  to: string;
  body: string;
  source?: string;
}

// Configuration - should be set in Supabase dashboard under Functions > Settings > Environment Variables
const CLICKSEND_USERNAME = Deno.env.get("CLICKSEND_USERNAME") || "";
const CLICKSEND_API_KEY = Deno.env.get("CLICKSEND_API_KEY") || "";
const SMS_SOURCE = Deno.env.get("SMS_SOURCE") || "PECH Prayer"; // This should be a valid source/sender name or number
 
  // Serve handles HTTP requests
Deno.serve(async (req) => {
  // Enable CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
    

  // Only allow POST method
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    // Parse request body
    const requestData: SmsRequestBody = await req.json();
    
    // Validate required parameters
    if (!requestData.recipients || !requestData.message || requestData.recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: recipients and message' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Check if ClickSend credentials are set
    if (!CLICKSEND_USERNAME || !CLICKSEND_API_KEY) {
      console.error('ClickSend credentials not configured');
      return new Response(
        JSON.stringify({ error: 'SMS service credentials not configured' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Prepare ClickSend API request payload
    const messages: SmsMessage[] = requestData.recipients.map((recipient) => ({
      to: recipient,
      body: requestData.message,
      source: SMS_SOURCE,
    }));

    const clickSendPayload = {
      messages: messages,
    };

    // Log what we're about to send (without credentials)
    console.log(`Sending ${messages.length} SMS messages via ClickSend`);

    // Make API request to ClickSend
    const response = await fetch('https://rest.clicksend.com/v3/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${CLICKSEND_USERNAME}:${CLICKSEND_API_KEY}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clickSendPayload),
    });

    // Get the response from ClickSend
    const result = await response.json();

    // Check if the request was successful
    if (response.status >= 200 && response.status < 300 && result.response_code === "SUCCESS") {
      console.log('SMS sent successfully:', JSON.stringify(result));
      
      // Return success response
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Successfully sent SMS to ${messages.length} recipients`,
        data: result
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } else {
      // Log the error
      console.error('Error from ClickSend API:', JSON.stringify(result));
      
      // Return error response
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to send SMS', 
        details: result 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  } catch (error) {
    // Log and return any errors
    console.error('Error processing SMS request:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
