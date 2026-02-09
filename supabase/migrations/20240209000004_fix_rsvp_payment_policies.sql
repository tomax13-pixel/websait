-- Drop potential conflicting or malformed policies on rsvps
DROP POLICY IF EXISTS "Members can update their own RSVPs" ON rsvps;
DROP POLICY IF EXISTS "Members can manage their own RSVPs" ON rsvps;

-- Re-create comprehensive policy for RSVPs
CREATE POLICY "Members can manage their own RSVPs" ON rsvps
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Drop potential conflicting policies on payments
DROP POLICY IF EXISTS "Members can insert their own payments" ON payments;
DROP POLICY IF EXISTS "Members can delete their own payments" ON payments;

-- Create policy for payments
CREATE POLICY "Members can insert their own payments" ON payments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
  
CREATE POLICY "Members can delete their own payments" ON payments
  FOR DELETE
  USING (user_id = auth.uid());
