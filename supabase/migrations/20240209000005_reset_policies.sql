-- Drop ALL potential conflicting policies on rsvps
DROP POLICY IF EXISTS "RSVPs are readable by circle members" ON rsvps;
DROP POLICY IF EXISTS "Members can update their own RSVPs" ON rsvps; -- old name
DROP POLICY IF EXISTS "Members can manage their own RSVPs" ON rsvps; -- new name

-- Drop ALL potential conflicting policies on payments
DROP POLICY IF EXISTS "Payments are readable by members" ON payments;
DROP POLICY IF EXISTS "Owners can manage payments" ON payments;
DROP POLICY IF EXISTS "Members can insert their own payments" ON payments; -- new name
DROP POLICY IF EXISTS "Members can delete their own payments" ON payments; -- new name

-- Re-create Policies

-- RSVPs: Read
CREATE POLICY "RSVPs are readable by circle members" ON rsvps
  FOR SELECT USING (
    event_id IN (
      SELECT id FROM events WHERE circle_id = get_my_circle_id()
    )
  );

-- RSVPs: Member Management (Insert/Update/Delete own)
CREATE POLICY "Members can manage their own RSVPs" ON rsvps
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Payments: Read
CREATE POLICY "Payments are readable by members" ON payments
  FOR SELECT USING (
    user_id = auth.uid() OR
    event_id IN (
      SELECT id FROM events WHERE circle_id = get_my_circle_id() AND
      EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
    )
  );

-- Payments: Owner Update
CREATE POLICY "Owners can manage payments" ON payments
  FOR UPDATE USING (
    event_id IN (
      SELECT id FROM events WHERE circle_id = get_my_circle_id() AND
      EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
    )
  );

-- Payments: Member Self-Insert (for auto-sync from RSVP)
CREATE POLICY "Members can insert their own payments" ON payments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
  
-- Payments: Member Self-Delete (for auto-sync from RSVP)
CREATE POLICY "Members can delete their own payments" ON payments
  FOR DELETE
  USING (user_id = auth.uid());
