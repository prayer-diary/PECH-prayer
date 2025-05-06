-- First, temporarily disable RLS to allow the operations to proceed
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Administrators can view all profiles" ON profiles; 
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Administrators can update any profile" ON profiles;
DROP POLICY IF EXISTS "Prayer calendar editors can access all profiles" ON profiles;
DROP POLICY IF EXISTS "Prayer calendar editors can update other profiles" ON profiles;
DROP POLICY IF EXISTS "Prayer calendar editors can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Prayer calendar editors can update prayer days" ON profiles;
DROP POLICY IF EXISTS "Prayer calendar editors can update prayer days and months" ON profiles;
DROP POLICY IF EXISTS "safe_prayer_calendar_editors_update" ON profiles;

-- Drop any existing helper functions we've tried
DROP FUNCTION IF EXISTS public.user_is_prayer_calendar_editor();
DROP FUNCTION IF EXISTS public.enforce_prayer_calendar_editor_permissions();
DROP FUNCTION IF EXISTS public.is_calendar_editor(UUID);
DROP FUNCTION IF EXISTS public.is_admin(UUID);

-- Create security definer functions that bypass RLS
-- Function to check if a user is an administrator
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  role TEXT;
BEGIN
  -- Direct query to avoid recursion
  SELECT user_role INTO role 
  FROM profiles 
  WHERE id = user_id;
  
  RETURN role = 'Administrator';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a user is a prayer calendar editor
CREATE OR REPLACE FUNCTION public.is_calendar_editor(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_editor BOOLEAN;
BEGIN
  -- Direct query to avoid recursion
  SELECT prayer_calendar_editor INTO is_editor 
  FROM profiles 
  WHERE id = user_id;
  
  RETURN COALESCE(is_editor, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create all policies using the safe functions
-- 1. Allow users to view their own profile
CREATE POLICY "Users can view their own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

-- 2. Allow administrators to view all profiles
CREATE POLICY "Administrators can view all profiles" 
  ON profiles FOR SELECT 
  USING (public.is_admin(auth.uid()));

-- 3. Allow users to update their own profile
CREATE POLICY "Users can update their own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

-- 4. Allow administrators to update all profiles
CREATE POLICY "Administrators can update any profile" 
  ON profiles FOR UPDATE 
  USING (public.is_admin(auth.uid()));

-- 5. Allow prayer calendar editors to update other profiles
CREATE POLICY "Prayer calendar editors can update other profiles"
  ON profiles FOR UPDATE
  USING (
    -- Different users' profiles (own profile is covered by other policy)
    auth.uid() != id AND 
    -- User is a calendar editor
    public.is_calendar_editor(auth.uid())
  );

-- 6. Allow prayer calendar editors to view all profiles (needed for editing)
CREATE POLICY "Prayer calendar editors can view all profiles"
  ON profiles FOR SELECT
  USING (public.is_calendar_editor(auth.uid()));

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;