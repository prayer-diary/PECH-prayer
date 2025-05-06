# Prayer Diary

A Progressive Web App (PWA) for church prayer ministry management.

## Overview

Prayer Diary is a web application that helps churches organize their prayer ministry with:

- Daily prayer calendar with rotating prayer subjects
- Weekly prayer updates with archiving
- Urgent prayer requests with notifications
- User profiles with customizable prayer points
- Multiple notification methods (email, SMS, WhatsApp, push)

## Technical Stack

- **Frontend**: HTML, CSS (Bootstrap framework), JavaScript (vanilla)
- **Backend**: Supabase (Authentication, Database, Storage)
- **Deployment**: GitHub Pages (or any web server)
- **PWA**: Service Worker for offline capability
- **Optional Integrations**: Email service, Twilio for SMS/WhatsApp

## Features

### Prayer Calendar
Displays daily prayer subjects with photos and prayer points on a rotating monthly schedule.

### Prayer Updates
Weekly summary of prayer matters with archiving capability.

### Urgent Prayer Requests
Time-sensitive prayer needs with multi-channel notification options.

### User Management
- Self-registration with admin approval
- Role-based permissions
- Customizable user profiles with prayer points
- Notification preferences

## Getting Started

1. Configure Supabase backend (see `docs/setup_guide.md`)
2. Update configuration in `js/config.js`
3. Deploy to a web server or GitHub Pages
4. Access the app and log in with the super admin account
5. Start adding users and prayer content

For detailed instructions, see:
- `docs/getting_started.md` - Quick start guide
- `docs/setup_guide.md` - Comprehensive setup instructions
- `docs/user_guide.md` - User manual
- `docs/implementation_steps.md` - Step-by-step implementation guide

## Installation as a PWA

The app can be installed as a Progressive Web App on:
- Android devices
- iOS devices
- Windows computers
- macOS computers

See the user guide for installation instructions specific to each platform.

## Customization

You can customize:
- Branding and logos
- Color scheme (edit `css/style.css`)
- Church-specific content

## Directory Structure

- `/css` - Stylesheets
- `/js` - JavaScript modules
- `/img` - Images and icons
- `/docs` - Documentation
- `/db` - Database schema

## License

This project is available for church use. Please provide attribution to the original creator.

## Support

For questions or assistance, refer to the documentation or contact your system administrator.
