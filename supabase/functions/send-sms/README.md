# ClickSend SMS Notification Edge Function

This Edge Function allows sending SMS notifications to users via the ClickSend API when a new prayer update or urgent prayer request is created.

## Deployment

To deploy this function to your Supabase project:

1. Install the Supabase CLI if you haven't already:
   ```
   npm install -g supabase
   ```

2. Login to Supabase:
   ```
   supabase login
   ```

3. Link to your Supabase project:
   ```
   supabase link --project-ref your-project-id
   ```

4. Deploy the function:
   ```
   supabase functions deploy send-sms
   ```

## Configuration

You'll need to set the following environment variables in the Supabase dashboard:

1. Go to your Supabase project dashboard
2. Navigate to Settings > API > Functions
3. Add the following secrets:
   - `CLICKSEND_USERNAME`: Your ClickSend account username or API key
   - `CLICKSEND_API_KEY`: Your ClickSend API key
   - `SMS_SOURCE`: The sender name or number that will appear as the source of the SMS (optional)

## Usage

The function expects a POST request with the following JSON body:

```json
{
  "recipients": ["phone_number1", "phone_number2", ...],
  "message": "Your SMS message content"
}
```

It will then send the message to all recipients using the ClickSend API.

## Testing

You can test the function using curl:

```
curl -X POST https://your-project-id.functions.supabase.co/send-sms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-anon-key" \
  -d '{"recipients": ["+12345678901"], "message": "Test message"}'
```

Or using the Supabase CLI:

```
supabase functions serve send-sms --env-file .env
```

Then in another terminal:

```
curl -X POST http://localhost:54321/functions/v1/send-sms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-anon-key" \
  -d '{"recipients": ["+12345678901"], "message": "Test message"}'
```

## Response

The function will return a JSON response with the following format:

```json
{
  "success": true,
  "message": "Successfully sent SMS to 2 recipients",
  "data": { 
    // ClickSend API response 
  }
}
```

Or in case of an error:

```json
{
  "success": false,
  "error": "Error message",
  "details": { 
    // Error details 
  }
}
```
