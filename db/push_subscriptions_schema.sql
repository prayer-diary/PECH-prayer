-- SQL to create or update the push_subscriptions table

-- Create the push_subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_data JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add active column if it doesn't exist (in case table already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'push_subscriptions' AND column_name = 'active'
  ) THEN
    ALTER TABLE push_subscriptions ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
END $$;

-- Add index for faster queries by user_id
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Enable Row Level Security if not already enabled
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid duplicates)
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON push_subscriptions;

-- Create policies
CREATE POLICY "Users can manage their own subscriptions" 
  ON push_subscriptions FOR ALL 
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions" 
  ON push_subscriptions FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.user_role = 'Administrator'
  ));

-- Comments for documentation
COMMENT ON TABLE push_subscriptions IS 'Stores web push notification subscriptions for users';
COMMENT ON COLUMN push_subscriptions.subscription_data IS 'JSON subscription data from PushManager.subscribe()';
COMMENT ON COLUMN push_subscriptions.active IS 'Whether the subscription is currently active';