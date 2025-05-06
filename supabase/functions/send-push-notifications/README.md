# Push Notification Edge Function

This Edge Function handles sending push notifications to users' devices based on their user IDs. It supports both Web Push API and Firebase Cloud Messaging (FCM) depending on your configuration.

## Features

- Sends push notifications to users who have registered their devices
- Supports Web Push API (for web browsers)
- Supports Firebase Cloud Messaging (FCM) for mobile apps
- Handles batch notifications to multiple users in a single request
- Includes error handling and detailed reporting

## Prerequisites

### Database Tables

This function requires two database tables:

1. `push_subscriptions` table with the following schema:
   ```sql
   create table push_subscriptions (
     id uuid primary key default uuid_generate_v4(),
     user_id uuid references auth.users not null,
     endpoint text not null,
     auth text not null,
     p256dh text not null,
     created_at timestamp with time zone default now()
   );
   ```

2. `device_tokens` table if you're using FCM:
   ```sql
   create table device_tokens (
     id uuid primary key default uuid_generate_v4(),
     user_id uuid references auth.users not null,
     token text not null unique,
     device_type text, -- 'android', 'ios', etc.
     created_at timestamp with time zone default now()
   );
   ```

### Environment Variables

You'll need to set these in the Supabase dashboard under Functions > Settings > Environment Variables:

**Required Variables:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for database access)

**For Web Push:**
- `VAPID_PUBLIC_KEY` - Your VAPID public key (for Web Push API)
- `VAPID_PRIVATE_KEY` - Your VAPID private key
- `VAPID_SUBJECT` - Usually your email address, e.g., `mailto:your-email@example.com`

**For Firebase Cloud Messaging:**
- `FCM_SERVER_KEY` - Your Firebase Cloud Messaging server key

## Usage

Send a POST request to the function with the following body:

```json
{
  "userIds": ["user-uuid-1", "user-uuid-2"],
  "title": "Prayer Update",
  "message": "New prayer update available",
  "contentType": "prayer_update",
  "contentId": "update-uuid", // Optional
  "data": {
    "url": "/updates-view", 
    "otherData": "any additional data"
  }
}
```

### Response

```json
{
  "success": true,
  "message": "Notifications sent: 2, failed: 0",
  "attempted": 2,
  "sent": 2,
  "failed": 0,
  "results": {
    "webPush": { "sent": 1, "failed": 0 },
    "fcm": { "sent": 1, "failed": 0 }
  }
}
```

## Deployment

To deploy this function to Supabase:

```bash
supabase functions deploy send-push-notifications
```

## Testing

You can test this function locally using the Supabase CLI:

```bash
supabase start
supabase functions serve send-push-notifications
```

Then make a POST request to `http://localhost:54321/functions/v1/send-push-notifications`

## Setting Up Push Notifications in the Frontend

To implement Web Push notifications in your application, you need to:

1. Request notification permission
2. Subscribe to push notifications
3. Send the subscription details to your Supabase backend
4. Configure your service worker to handle push events

For a complete implementation guide, see the Web Push documentation at [web-push-codelab](https://web-push-codelab.glitch.me/).

## Security Considerations

- This function uses the Supabase service role key, which has admin privileges. Make sure to properly validate input.
- VAPID keys should be kept secure. The private key should never be exposed to clients.
- Consider adding additional authentication checks depending on your app's security requirements.
