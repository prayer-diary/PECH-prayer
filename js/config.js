// Supabase Configuration
const SUPABASE_URL = 'https://ozwcgtfoyfvwlgjokrix.supabase.co'; // Replace with your Supabase URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96d2NndGZveWZ2d2xnam9rcml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0NDI0MzIsImV4cCI6MjA1OTAxODQzMn0.IRQRv26j9j-VcJT8p91DiA6kHs_c8b2R12Akp38ahZE'; // Replace with your Supabase anon key

// Initialize Supabase client without development cache control headers
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ClickSend configuration (for SMS notifications)
const TWILIO_ENABLED = true; // Enabled for ClickSend SMS integration

// WhatsApp configuration (using Meta Business Platform)
const WHATSAPP_ENABLED = true; // Enabled for WhatsApp notification integration

// Email configuration
const EMAIL_ENABLED = true; // Set to true once configured

// Push notification configuration
const PUSH_NOTIFICATION_ENABLED = true; // Enabled for push notification integration

// App constants
const APP_NAME = 'Prayer Diary';
// This is the canonical app version used across the app
const APP_VERSION = '1.1.122';