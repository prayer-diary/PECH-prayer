-- Create prayer_topics table
CREATE TABLE prayer_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  topic_title TEXT NOT NULL,
  topic_text TEXT NOT NULL,
  pray_day INTEGER DEFAULT 0 CHECK (pray_day BETWEEN 0 AND 31),
  pray_months INTEGER DEFAULT 0 CHECK (pray_months BETWEEN 0 AND 2),
  topic_image_url TEXT
);

-- Enable Row Level Security
ALTER TABLE prayer_topics ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
-- Allow all authenticated users to read
CREATE POLICY "Allow authenticated users to read prayer topics" 
  ON prayer_topics 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Allow calendar editors to create/update/delete
CREATE POLICY "Allow calendar editors to insert prayer topics" 
  ON prayer_topics 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.prayer_calendar_editor = true 
        OR profiles.user_role = 'Administrator'
      )
    )
  );

CREATE POLICY "Allow calendar editors to update prayer topics" 
  ON prayer_topics 
  FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.prayer_calendar_editor = true 
        OR profiles.user_role = 'Administrator'
      )
    )
  );

CREATE POLICY "Allow calendar editors to delete prayer topics" 
  ON prayer_topics 
  FOR DELETE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.prayer_calendar_editor = true 
        OR profiles.user_role = 'Administrator'
      )
    )
  );
