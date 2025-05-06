# Prayer Diary Implementation Steps

This document provides a step-by-step guide to deploying the Prayer Diary app from scratch.

## 1. Set Up Supabase Backend

1. **Create a Supabase Account**
   - Go to [supabase.com](https://supabase.com) and sign up for a free account
   - Create a new project and note down the project URL and anon key

2. **Run Database Schema**
   - Navigate to the SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `db/schema.sql` into the editor
   - Run the SQL script to create all necessary tables and security policies
   - If you're upgrading an existing installation, you'll need to run the following SQL scripts:
     - `db/add_profile_set_field.sql` to add the profile completion tracking
     - `db/update_notification_settings.sql` to update the notification settings structure
     - `db/add_gdpr_field.sql` to add GDPR consent tracking

3. **Set Up Storage Buckets**
   - Create a new bucket named `prayer-diary`
   - Inside that bucket, create folders: `profiles` and `calendar`
   - Set up public access for the buckets
   - **IMPORTANT:** Execute the SQL file `db/fix_problem_with_saving_profiles.sql` to apply the necessary Storage policies that allow users to save their profiles before approval

4. **Configure Email Authentication**
   - Enable email authentication in the Authentication settings
   - Configure email templates for account confirmation and password reset

## 2. Configure the App

1. **Update Configuration**
   - Edit `js/config.js` and replace:
     - `YOUR_SUPABASE_URL` with your Supabase project URL
     - `YOUR_SUPABASE_ANON_KEY` with your Supabase anon key

2. **Set Up Initial Super Admin**
   - The app will attempt to create a super admin account with the following credentials:
     - Email: `prayerdiary@pech.co.uk`
     - Password: `@Prayer@Diary@`
   - If this fails, you can manually create the super admin account using the Supabase dashboard

## 3. Deploy to GitHub Pages

1. **Create a GitHub Repository**
   - Create a new repository on GitHub
   - Initialize it with a README if you prefer

2. **Upload the App Files**
   - Clone the repository to your local machine
   - Copy all the Prayer Diary files to the repository folder
   - Commit and push the changes to GitHub

3. **Enable GitHub Pages**
   - Go to your repository settings
   - Navigate to the Pages section
   - Select the main branch as the source
   - Save the settings

4. **Access Your App**
   - Your app will be available at: `https://yourusername.github.io/repository-name/`
   - It may take a few minutes for GitHub Pages to deploy your site

## 4. Additional Features Setup (Optional)

These steps are optional and can be implemented if you need additional features.

### Email Notifications

1. Set up a serverless function with a service like Supabase Edge Functions, Vercel, or Netlify
2. Implement an email sending function using services like SendGrid or AWS SES
3. Update `EMAIL_ENABLED = true` in `js/config.js`
4. Update the email function URLs in the notification code

### SMS and WhatsApp Notifications via Twilio

1. Create a Twilio account and obtain API credentials
2. Set up a Twilio phone number with SMS and WhatsApp capabilities
3. Implement a serverless function to send messages via Twilio
4. Update `TWILIO_ENABLED = true` in `js/config.js`
5. Update the Twilio function URLs in the notification code

### Push Notifications

1. Generate VAPID keys for web push notifications
2. Update the service worker with your VAPID public key
3. Implement a serverless function to send push notifications
4. Update `PUSH_NOTIFICATION_ENABLED = true` in `js/config.js`

## 5. Testing and Verification

1. **Test User Registration**
   - Register a new user account
   - Log in as the admin and approve the new user
   - Verify the new user is prompted to complete their profile before accessing other features
   - Verify that email notifications are selected by default for both Prayer Updates and Urgent Prayers

2. **Test Prayer Calendar**
   - Add users and other prayer subjects to the calendar
   - Verify they appear on the correct days
   - Test viewing prayer cards

3. **Test Prayer Updates**
   - Create a prayer update as an admin
   - Verify it appears in the updates section
   - Test archiving updates

4. **Test Urgent Prayer Requests**
   - Create an urgent prayer request as an admin
   - Verify it appears in the urgent prayers section
   - Test notifications if enabled

5. **Test PWA Installation**
   - Verify the app can be installed as a PWA on different devices
   - Test offline functionality

## 6. Maintenance and Backup

1. **Regular Backups**
   - Set up regular backups of your Supabase database
   - Export the data periodically as a safety measure

2. **Updates and Maintenance**
   - Monitor Supabase for any updates or changes
   - Keep your dependencies up to date

3. **User Management**
   - Regularly review user accounts
   - Remove inactive users if necessary

## 7. Troubleshooting

If you encounter issues during the implementation:

1. **Authentication Issues**
   - Verify your Supabase URL and anon key
   - Check if the email provider is properly configured

2. **Database Issues**
   - Verify the schema was executed correctly
   - Check row-level security policies

3. **Storage Issues**
   - Verify storage bucket permissions
   - Check if the bucket paths are correct

4. **Deployment Issues**
   - Ensure all files are properly uploaded to GitHub
   - Check if GitHub Pages is properly configured

For more detailed information, refer to the full setup guide and user guide in the docs folder.
