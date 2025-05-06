-- SECURE STORAGE POLICIES FOR PRAYER DIARY
-- ========================================
-- 
-- This script configures storage policies to only allow authenticated users to access images.
-- These policies provide proper security while allowing the application to function correctly.
--
-- IMPLEMENTATION INSTRUCTIONS:
-- 1. In Supabase dashboard, go to Storage → Buckets
-- 2. Select the "prayer-diary" bucket
-- 3. Set the bucket to PRIVATE (not public)
-- 4. Go to SQL Editor
-- 5. Copy and paste this entire file
-- 6. Run the SQL statements
-- 7. Verify that the policies have been applied in Storage → Policies

-- First, clean up ALL existing policies including those from fix_storage_policies.sql
DROP POLICY IF EXISTS "Users can upload their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Admin users can access all objects" ON storage.objects;
DROP POLICY IF EXISTS "Public access to profiles folder" ON storage.objects;
DROP POLICY IF EXISTS "Temporary unrestricted access" ON storage.objects;

-- Create policy that only allows authenticated users to view profile images
CREATE POLICY "Only authenticated users can view profile images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'prayer-diary' AND
  name LIKE 'profiles/%' AND
  auth.role() = 'authenticated'
);

-- Allow users to upload their own profile images
DROP POLICY IF EXISTS "Users can upload their own profile images" ON storage.objects;
CREATE POLICY "Users can upload their own profile images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'prayer-diary' AND
  name LIKE 'profiles/%' AND
  name LIKE 'profiles/' || auth.uid() || '_%'
);

-- Allow users to update or replace their own profile images
DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
CREATE POLICY "Users can update their own profile images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'prayer-diary' AND
  name LIKE 'profiles/%' AND
  name LIKE 'profiles/' || auth.uid() || '_%'
);

-- Allow administrators to access all objects (if needed)
DROP POLICY IF EXISTS "Administrators can access all storage objects" ON storage.objects;
CREATE POLICY "Administrators can access all storage objects"
ON storage.objects FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE 
      id = auth.uid() AND 
      user_role = 'Administrator'
  )
);

-- Important: In the Supabase Dashboard, make sure to set the bucket to PRIVATE, not public
