# Prayer Diary Deployment Checklist

Use this checklist to ensure your Prayer Diary app is fully configured and ready for production use.

## Prerequisites

- [ ] Supabase account created
- [ ] New Supabase project created
- [ ] Supabase project URL and anon key noted
- [ ] GitHub account (if deploying to GitHub Pages)
- [ ] Local copy of the Prayer Diary app files

## Database Setup

- [ ] SQL schema from `db/schema.sql` run in Supabase SQL Editor
- [ ] Tables created:
  - [ ] profiles
  - [ ] prayer_calendar
  - [ ] prayer_updates
  - [ ] urgent_prayers
  - [ ] notification_logs
- [ ] RLS (Row Level Security) policies enabled on all tables
- [ ] Triggers for new user creation set up

## Storage Setup

- [ ] `prayer-diary` storage bucket created in Supabase
- [ ] Folders created in the bucket:
  - [ ] `profiles`
  - [ ] `calendar`
- [ ] Public access policies configured for the storage bucket

## Authentication Setup

- [ ] Email authentication enabled in Supabase
- [ ] Email templates customized (optional)
- [ ] Super admin account created
  - [ ] Email: `prayerdiary@pech.co.uk`
  - [ ] Password: `@Prayer@Diary@`
  - [ ] Or custom admin credentials noted: _________________

## App Configuration

- [ ] `js/config.js` updated with:
  - [ ] Supabase project URL
  - [ ] Supabase anon key
  - [ ] Notification settings (if applicable)
- [ ] Church name/branding updated (optional):
  - [ ] Title in `index.html`
  - [ ] Colors in `css/style.css`
  - [ ] Logo image in `img/logo.png`

## Optional Features Setup

- [ ] Email notifications:
  - [ ] Email service account created
  - [ ] Serverless function deployed
  - [ ] `EMAIL_ENABLED` set to `true` in config
- [ ] SMS/WhatsApp notifications:
  - [ ] Twilio account created
  - [ ] Twilio phone number purchased
  - [ ] Serverless function deployed
  - [ ] `TWILIO_ENABLED` set to `true` in config
- [ ] Push notifications:
  - [ ] VAPID keys generated
  - [ ] Service worker updated with VAPID public key
  - [ ] Serverless function deployed
  - [ ] `PUSH_NOTIFICATION_ENABLED` set to `true` in config

## Deployment

- [ ] All files prepared for deployment
- [ ] GitHub repository created (if using GitHub Pages)
- [ ] Files uploaded to the repository
- [ ] GitHub Pages enabled in repository settings
- [ ] Or, files uploaded to alternate web hosting service
- [ ] Deployment URL noted: _________________

## Verification and Testing

- [ ] Run the verification script from the browser console
- [ ] Test account registration
- [ ] Test logging in with admin account
- [ ] Test user approval process
- [ ] Test prayer calendar functionality
- [ ] Test prayer updates functionality
- [ ] Test urgent prayer requests functionality
- [ ] Test notification functionality (if enabled)
- [ ] Test PWA installation on different devices

## Documentation and User Onboarding

- [ ] Setup guide reviewed for accuracy
- [ ] User guide prepared for distribution
- [ ] Initial admin user trained
- [ ] Launch announcement prepared

## Final Launch Checklist

- [ ] All critical issues resolved
- [ ] App performance satisfactory
- [ ] Security measures verified
- [ ] Backup plan established
- [ ] Support contact identified

## Notes

Use this space for any additional notes or customizations:

__________________________________________________________
__________________________________________________________
__________________________________________________________
__________________________________________________________
__________________________________________________________
