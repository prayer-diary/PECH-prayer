-- Prayer Updates policies
-- Anyone can read prayer updates if they're approved
CREATE POLICY "Approved users can view prayer updates" 
  ON prayer_updates FOR SELECT 
  USING ((SELECT approval_state FROM profiles WHERE id = auth.uid()) = 'Approved');

-- Only prayer update editors can insert/update/delete
CREATE POLICY "Prayer update editors can manage prayer updates" 
  ON prayer_updates FOR ALL 
  USING ((SELECT prayer_update_editor FROM profiles WHERE id = auth.uid()) = TRUE);
