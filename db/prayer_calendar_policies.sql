-- Prayer Calendar policies
-- Anyone can read the prayer calendar if they're approved
CREATE POLICY "Approved users can view prayer calendar" 
  ON prayer_calendar FOR SELECT 
  USING ((SELECT approval_state FROM profiles WHERE id = auth.uid()) = 'Approved');

-- Only prayer calendar editors can insert/update/delete
CREATE POLICY "Prayer calendar editors can manage prayer calendar" 
  ON prayer_calendar FOR ALL 
  USING ((SELECT prayer_calendar_editor FROM profiles WHERE id = auth.uid()) = TRUE);