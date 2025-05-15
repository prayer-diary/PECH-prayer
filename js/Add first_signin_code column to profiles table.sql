-- Add first_signin_code column to the profiles table
ALTER TABLE profiles 
ADD COLUMN first_signin_code INTEGER NOT NULL DEFAULT 0;

-- Add comment explaining the column's purpose
COMMENT ON COLUMN profiles.first_signin_code IS 'Verification code for first sign-in. 0 = verified, 999999 = blocked, other values = pending verification';