-- Create a separate table for email-only users
CREATE TABLE email_only_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_email_sent TIMESTAMP WITH TIME ZONE
);

-- Set up Row Level Security (RLS) for email_only_users
ALTER TABLE email_only_users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow only administrators to manage email-only users
CREATE POLICY "Administrators can manage email-only users" 
ON email_only_users 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_role = 'Administrator'
  )
);

-- Create index on email field for faster lookups
CREATE INDEX email_only_users_email_idx ON email_only_users (email);

COMMENT ON TABLE email_only_users IS 'Users who only receive emails and do not log in to the application';
