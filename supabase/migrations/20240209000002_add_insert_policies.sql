-- Allow authenticated users to create circles
CREATE POLICY "Authenticated users can create circles" ON circles
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to manage their own profile (INSERT/UPDATE/DELETE)
CREATE POLICY "Users can manage own profile" ON profiles
  FOR ALL USING (user_id = auth.uid());
