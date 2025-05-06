-- Notification Logs policies
-- Users can view their own notification logs
CREATE POLICY "Users can view their own notification logs" 
  ON notification_logs FOR SELECT 
  USING (auth.uid() = user_id);

-- Administrators can view all notification logs
CREATE POLICY "Administrators can view all notification logs" 
  ON notification_logs FOR SELECT 
  USING ((SELECT user_role FROM profiles WHERE id = auth.uid()) = 'Administrator');