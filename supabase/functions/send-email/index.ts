// Modern Supabase Edge Function for sending emails using nodemailer (compatible with latest Deno)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// Import NodeMailer using Deno compatibility layer
import nodemailer from 'npm:nodemailer@6.9.3';
// Improved CORS handling with all possible headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey, cache-control, pragma, expires',
  'Access-Control-Max-Age': '86400'
};
serve(async (req)=>{
  console.log(`[${new Date().toISOString()}] ${req.method} request received`);
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS (preflight) request');
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  // Test connection endpoint
  if (req.method === 'GET') {
    console.log('Handling GET test connection request');
    return new Response(JSON.stringify({
      status: 'ok',
      message: 'Email function is deployed and reachable',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
  try {
    // Only allow POST for sending emails
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
    // Parse request body
    let requestData;
    try {
      requestData = await req.json();
      console.log('Request received:', {
        to: requestData.to ? '[REDACTED]' : undefined,
        subject: requestData.subject,
        testConnection: requestData.testConnection,
        checkEnvironment: requestData.checkEnvironment
      });
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return new Response(JSON.stringify({
        error: 'Invalid JSON in request body',
        details: parseError.message
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    // Handle test connection request
    if (requestData.testConnection === true) {
      console.log('Handling test connection request via POST');
      return new Response(JSON.stringify({
        status: 'ok',
        message: 'Email function is deployed and reachable',
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    // Handle environment check request
    if (requestData.checkEnvironment === true) {
      // Get environment variables (sanitized)
      const SMTP_HOSTNAME = Deno.env.get('SMTP_HOSTNAME') || 'smtp.gmail.com';
      const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '465');
      const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME') ? 'PROVIDED' : 'MISSING';
      const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD') ? 'PROVIDED' : 'MISSING';
      const DEFAULT_FROM = Deno.env.get('DEFAULT_FROM') || 'Prayer Diary <prayerdiary@pech.co.uk>';
      return new Response(JSON.stringify({
        status: 'ok',
        environment: {
          SMTP_HOSTNAME,
          SMTP_PORT,
          SMTP_USERNAME_SET: SMTP_USERNAME,
          SMTP_PASSWORD_SET: SMTP_PASSWORD,
          DEFAULT_FROM
        },
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    // Validate required fields
    if (!requestData.to || !requestData.subject || !requestData.html) {
      console.log('Missing required email parameters');
      return new Response(JSON.stringify({
        error: 'Missing required email parameters',
        requiredFields: [
          'to',
          'subject',
          'html'
        ],
        receivedFields: Object.keys(requestData)
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    // Environment variables
    const SMTP_HOSTNAME = Deno.env.get('SMTP_HOSTNAME') || 'smtp.gmail.com';
    const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '465');
    const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME');
    const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD');
    const DEFAULT_FROM = Deno.env.get('DEFAULT_FROM') || 'Prayer Diary <prayerdiary@pech.co.uk>';
    // Validate SMTP credentials
    if (!SMTP_USERNAME || !SMTP_PASSWORD) {
      console.error('Missing SMTP credentials');
      return new Response(JSON.stringify({
        error: 'Missing SMTP credentials',
        message: 'The SMTP username or password is not configured. Set them using "supabase secrets set"',
        details: {
          SMTP_HOSTNAME: SMTP_HOSTNAME,
          SMTP_PORT: SMTP_PORT,
          SMTP_USERNAME: SMTP_USERNAME ? 'PROVIDED' : 'MISSING',
          SMTP_PASSWORD: SMTP_PASSWORD ? 'PROVIDED' : 'MISSING'
        }
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    console.log(`Creating transport with ${SMTP_HOSTNAME}:${SMTP_PORT}`);
    try {
      // Create NodeMailer transport
      const transport = nodemailer.createTransport({
        host: SMTP_HOSTNAME,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: {
          user: SMTP_USERNAME,
          pass: SMTP_PASSWORD
        }
      });
      console.log('Transport created, verifying connection...');
      // Verify connection configuration
      try {
        await transport.verify();
        console.log('Connection verified successfully');
      } catch (verifyError) {
        console.error('Transport verification failed:', verifyError);
        return new Response(JSON.stringify({
          error: 'SMTP connection verification failed',
          message: verifyError.message || 'Unknown error during SMTP verification',
          details: verifyError.toString(),
          config: {
            hostname: SMTP_HOSTNAME,
            port: SMTP_PORT,
            username: SMTP_USERNAME ? 'PROVIDED' : 'MISSING'
          }
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      // Prepare email
      const mailOptions = {
        from: requestData.from || DEFAULT_FROM,
        to: requestData.to,
        subject: requestData.subject,
        html: requestData.html,
        text: requestData.text || requestData.html.replace(/<[^>]*>/g, ''),
        cc: requestData.cc,
        bcc: requestData.bcc,
        replyTo: requestData.replyTo
      };
      console.log('Sending email...');
      // Send mail
      const info = await transport.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      // Return success response
      return new Response(JSON.stringify({
        success: true,
        messageId: info.messageId,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      return new Response(JSON.stringify({
        error: 'Failed to send email',
        message: emailError.message || 'Unknown error occurred',
        details: emailError.toString(),
        config: {
          hostname: SMTP_HOSTNAME,
          port: SMTP_PORT,
          username: SMTP_USERNAME ? 'PROVIDED' : 'MISSING'
        }
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  } catch (error) {
    console.error('General error:', error);
    return new Response(JSON.stringify({
      error: 'Server error',
      message: error.message || 'An unknown error occurred',
      details: error.toString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});
