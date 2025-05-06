-- To create a super admin account, run the following in your application
-- or directly in Supabase Auth UI and then run this SQL:
-- Replace [ADMIN_USER_ID] with the UUID of the admin user you created

INSERT INTO profiles (id, full_name, user_role, approval_state, prayer_calendar_editor, prayer_update_editor, urgent_prayer_editor)
VALUES ('[ADMIN_USER_ID]', 'Super Admin', 'Administrator', 'Approved', TRUE, TRUE, TRUE);
