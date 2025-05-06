// supabase/functions/send-whatsapp/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers to allow requests from your app domain
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Replace with your domain in production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Log request info for debugging
  console.log("[WhatsApp] Received request:", req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("[WhatsApp] Handling CORS preflight request");
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    console.log("[WhatsApp] Parsing request body");
    const parsedRequest = await req.json();
    console.log("[WhatsApp] Request body:", JSON.stringify(parsedRequest));
    
    const { phoneNumber, message, templateName, templateParams } = parsedRequest;
    
    // Validate input
    if (!phoneNumber || (!message && !templateName)) {
      console.error("[WhatsApp] Validation error: Missing required parameters");
      return new Response(
        JSON.stringify({ success: false, error: 'Phone number and either message or template are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Format the phone number (remove + if present)
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;
    console.log(`[WhatsApp] Formatted phone number: ${formattedPhone}`);
    
    // WhatsApp API credentials
    const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN');
    const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID');
    
    // Debug environment variables
    console.log(`[WhatsApp] Phone ID available: ${!!WHATSAPP_PHONE_ID}`);
    console.log(`[WhatsApp] Token available: ${!!WHATSAPP_TOKEN}`);
    
    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
      console.error("[WhatsApp] Missing environment variables");
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp API credentials not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    let requestBody;
    let apiUrl = `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`;
    console.log(`[WhatsApp] API URL: ${apiUrl}`);
    
    // Check if we're using a template or a direct message
    if (templateName) {
      console.log(`[WhatsApp] Using template: ${templateName}`);
      // Template message format
      requestBody = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: "en_US" },
          components: templateParams || []
        }
      };
      console.log("[WhatsApp] Template request body:", JSON.stringify(requestBody));
    } else {
      console.log(`[WhatsApp] Using direct message`);
      // Text message format (only for 24-hour window)
      requestBody = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "text",
        text: { body: message }
      };
      console.log("[WhatsApp] Text message request body:", JSON.stringify(requestBody));
    }
    
    // Send the message to WhatsApp API
    console.log("[WhatsApp] Sending request to Meta API");
    
    // Log token length and format (without revealing the actual token)
    const tokenLength = WHATSAPP_TOKEN ? WHATSAPP_TOKEN.length : 0;
    console.log(`[WhatsApp] Token length: ${tokenLength}`);
    
    if (WHATSAPP_TOKEN) {
      // Log first 5 and last 5 chars of token for debugging
      const tokenPrefix = WHATSAPP_TOKEN.substring(0, 5);
      const tokenSuffix = WHATSAPP_TOKEN.length > 5 ? WHATSAPP_TOKEN.substring(WHATSAPP_TOKEN.length - 5) : '';
      console.log(`[WhatsApp] Token format check: Bearer ${tokenPrefix}...${tokenSuffix}`);
    } else {
      console.error("[WhatsApp] Token is empty or undefined");
    }
    
    // Log all headers being sent (except full auth token)
    const headers = {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    };
    
    console.log("[WhatsApp] Request headers:", JSON.stringify({
      ...headers,
      'Authorization': headers.Authorization ? 'Bearer [REDACTED]' : undefined
    }));
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });
    
    // Get the response status
    console.log(`[WhatsApp] Meta API response status: ${response.status} ${response.statusText}`);
    
    // Log response headers
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    console.log(`[WhatsApp] Response headers:`, JSON.stringify(responseHeaders));
    
    // Parse the response
    const responseData = await response.json();
    console.log(`[WhatsApp] Meta API response data:`, JSON.stringify(responseData));
    
    // Check for specific error patterns
    if (!response.ok) {
      console.error(`[WhatsApp] Error response from Meta API: ${response.status}`);
      
      // Check for specific error codes
      if (responseData.error) {
        console.error(`[WhatsApp] Error code: ${responseData.error.code}`);
        console.error(`[WhatsApp] Error message: ${responseData.error.message}`);
        console.error(`[WhatsApp] Error type: ${responseData.error.type}`);
        
        // Check for specific error conditions
        if (responseData.error.code === 190) {
          console.error("[WhatsApp] Error 190: Invalid or expired access token");
        } else if (responseData.error.code === 100) {
          console.error("[WhatsApp] Error 100: Invalid parameter or permission issue");
        } else if (responseData.error.code === 10) {
          console.error("[WhatsApp] Error 10: Permission issue - check app permissions");
        }
      }
    }
    
    // Return the result
    return new Response(
      JSON.stringify({ success: response.ok, data: responseData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.ok ? 200 : 400 }
    );
    
  } catch (error) {
    // Log the full error details
    console.error("[WhatsApp] Error processing request:", error);
    console.error("[WhatsApp] Error stack:", error.stack);
    
    // Handle any errors
    return new Response(
      JSON.stringify({ success: false, error: error.message, stack: error.stack }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});