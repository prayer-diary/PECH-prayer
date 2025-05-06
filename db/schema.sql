-- Extend the auth.users table with a profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  updated_at TIMESTAMP WITH TIME ZONE,
  full_name TEXT,
  email TEXT, -- Added email field to store the user's email address
  profile_image_url TEXT,
  prayer_points TEXT,
  user_role TEXT NOT NULL DEFAULT 'User',
  approval_state TEXT NOT NULL DEFAULT 'Pending',
  prayer_calendar_editor BOOLEAN NOT NULL DEFAULT FALSE,
  prayer_update_editor BOOLEAN NOT NULL DEFAULT FALSE,
  urgent_prayer_editor BOOLEAN NOT NULL DEFAULT FALSE,
  notification_push BOOLEAN NOT NULL DEFAULT FALSE, -- Keeping for future use
  phone_number TEXT,
  whatsapp_number TEXT,
  profile_set BOOLEAN NOT NULL DEFAULT FALSE,
  gdpr_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  photo_tag TEXT,
  calendar_hide BOOLEAN NOT NULL DEFAULT FALSE,
  content_delivery_email BOOLEAN NOT NULL DEFAULT FALSE,
  notification_method TEXT NOT NULL DEFAULT 'none',
  CONSTRAINT user_role_check CHECK (user_role IN ('Administrator', 'User')),
  CONSTRAINT approval_state_check CHECK (approval_state IN ('Pending', 'Approved', 'Rejected', 'emailonly'))
);

-- Create a table for prayer calendar entries
CREATE TABLE prayer_calendar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  name TEXT NOT NULL,
  image_url TEXT,
  prayer_points TEXT,
  is_user BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE
);

-- Create a table for weekly prayer updates
CREATE TABLE prayer_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  update_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Create a table for urgent prayer requests
CREATE TABLE urgent_prayers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  update_date DATE NOT NULL DEFAULT CURRENT_DATE

);

-- Create a table for notification logs
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_id UUID NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT
);

-- Set up Row Level Security (RLS)
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE urgent_prayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;









  
