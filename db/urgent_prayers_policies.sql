-- Urgent Prayers policies
-- Anyone can read urgent prayers if they're approved
CREATE POLICY "Approved users can view urgent prayers" 
  ON urgent_prayers FOR SELECT 
  USING ((SELECT approval_state FROM profiles WHERE id = auth.uid()) = 'Approved');

-- Only urgent prayer editors can insert/update/delete
CREATE POLICY "Urgent prayer editors can manage urgent prayers" 
  ON urgent_prayers FOR ALL 
  USING ((SELECT urgent_prayer_editor FROM profiles WHERE id = auth.uid()) = TRUE);
