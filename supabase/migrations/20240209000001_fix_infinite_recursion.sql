-- Create a function to get the current user's circle_id securely
-- This avoids infinite recursion in RLS policies by bypassing RLS on the profiles table
CREATE OR REPLACE FUNCTION get_my_circle_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT circle_id FROM profiles WHERE user_id = auth.uid();
$$;

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Circle profiles are readable by members" ON profiles;
DROP POLICY IF EXISTS "Circles are readable by members" ON circles;
DROP POLICY IF EXISTS "Events are readable by circle members" ON events;
DROP POLICY IF EXISTS "Owners can manage events" ON events;
DROP POLICY IF EXISTS "RSVPs are readable by circle members" ON rsvps;
DROP POLICY IF EXISTS "Payments are readable by members" ON payments;
DROP POLICY IF EXISTS "Owners can manage payments" ON payments;
DROP POLICY IF EXISTS "Announcements are visible to circle members" ON announcements;
DROP POLICY IF EXISTS "Owners can manage announcements" ON announcements;

-- Re-create policies using the secure function

-- Profiles: Members can read profiles in the same circle (using function)
CREATE POLICY "Circle profiles are readable by members" ON profiles
  FOR SELECT USING (
    circle_id = get_my_circle_id()
  );

-- Also ensure a user can always read their own profile (for initial setup/login)
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- Circles: Members can read their own circle
CREATE POLICY "Circles are readable by members" ON circles
  FOR SELECT USING (
    id = get_my_circle_id()
  );

-- Events: Read access for circle members
CREATE POLICY "Events are readable by circle members" ON events
  FOR SELECT USING (
    circle_id = get_my_circle_id()
  );

-- Events: Owner management
CREATE POLICY "Owners can manage events" ON events
  FOR ALL USING (
    circle_id = get_my_circle_id() AND 
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
  );

-- RSVPs: Read access
CREATE POLICY "RSVPs are readable by circle members" ON rsvps
  FOR SELECT USING (
    event_id IN (
      SELECT id FROM events WHERE circle_id = get_my_circle_id()
    )
  );

-- Payments: Read access
CREATE POLICY "Payments are readable by members" ON payments
  FOR SELECT USING (
    user_id = auth.uid() OR
    event_id IN (
      SELECT id FROM events WHERE circle_id = get_my_circle_id() AND
      EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
    )
  );

-- Payments: Owner can update
CREATE POLICY "Owners can manage payments" ON payments
  FOR UPDATE USING (
    event_id IN (
      SELECT id FROM events WHERE circle_id = get_my_circle_id() AND
      EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
    )
  );

-- Announcements: Circle visibility
CREATE POLICY "Announcements are visible to circle members" ON announcements
  FOR SELECT USING (
    circle_id = get_my_circle_id()
  );

-- Announcements: Owner management
CREATE POLICY "Owners can manage announcements" ON announcements
  FOR ALL USING (
    circle_id = get_my_circle_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
  );
