# Prayer Diary - Getting Started Guide

Welcome to Prayer Diary! This quick guide will help you get started with the app right away.

## Quick Setup for Technical Users

1. **Set up Supabase**:
   - Create an account at [supabase.com](https://supabase.com)
   - Create a new project
   - Run the SQL in `db/schema.sql` in the SQL Editor
   - Create a storage bucket named `prayer-diary` with folders for `profiles` and `calendar`

2. **Configure the App**:
   - Update `js/config.js` with your Supabase URL and anon key
   - Deploy to a web server or GitHub Pages

3. **Create the Super Admin**:
   - The app will attempt to create a super admin account with:
     - Email: `prayerdiary@pech.co.uk`
     - Password: `@Prayer@Diary@`
   - You can manually create this account if needed

4. **Access the App**:
   - Open the app in a web browser
   - Log in with the super admin credentials
   - Start adding users and prayer content

## Key Features Overview

### For Administrators

1. **User Management**:
   - Approve new user registrations
   - Assign permissions (Prayer Calendar Editor, Prayer Update Editor, Urgent Prayer Editor)
   - Manage user roles

2. **Prayer Calendar Management**:
   - Add users and other subjects to specific days
   - Edit prayer calendar entries
   - View the prayer calendar

3. **Prayer Updates**:
   - Create weekly prayer updates
   - Archive old updates
   - Send notifications for new updates

4. **Urgent Prayer Requests**:
   - Create urgent prayer requests
   - Send notifications via multiple channels
   - Manage active urgent prayer requests

### For Users

1. **Daily Prayer Calendar**:
   - View who to pray for each day
   - See detailed prayer cards

2. **Prayer Updates**:
   - Read weekly prayer updates
   - Access archived updates

3. **Urgent Prayer Requests**:
   - Receive and view urgent prayer requests

4. **Profile Management**:
   - Update personal information
   - Set prayer points for others to pray for
   - Configure notification preferences

## Next Steps

1. **Read the Complete Docs**:
   - `setup_guide.md` - Detailed setup instructions
   - `user_guide.md` - Comprehensive user manual
   - `implementation_steps.md` - Step-by-step implementation guide

2. **Enable Advanced Features**:
   - Email notifications
   - SMS and WhatsApp notifications via Twilio
   - Push notifications

3. **Customize the App**:
   - Modify the branding in `index.html`
   - Update the color scheme in `css/style.css`
   - Add your church logo to the `img` folder

## Quick Troubleshooting

- **Login Issues**: Verify Supabase URL and anon key in `js/config.js`
- **Database Issues**: Check if schema was properly executed
- **Image Upload Problems**: Verify storage bucket permissions
- **User Approval**: Make sure you're logged in as an administrator

For more help, consult the detailed documentation or contact the developer.
