-- 1. circles
CREATE TABLE circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. profiles (extends auth.users)
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  datetime TIMESTAMPTZ NOT NULL,
  place TEXT,
  fee INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  rsvp_deadline TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. rsvps
CREATE TABLE rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
  comment TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- 5. payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('unpaid', 'paid')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- 6. announcements
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. owner_invites
CREATE TABLE owner_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_invites ENABLE ROW LEVEL SECURITY;

-- Policies

-- Profiles: Members can read profiles in the same circle
CREATE POLICY "Circle profiles are readable by members" ON profiles
  FOR SELECT USING (
    circle_id IN (
      SELECT circle_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Circles: Members can read their own circle
CREATE POLICY "Circles are readable by members" ON circles
  FOR SELECT USING (
    id IN (
      SELECT circle_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Events: Read access for circle members
CREATE POLICY "Events are readable by circle members" ON events
  FOR SELECT USING (
    circle_id IN (
      SELECT circle_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Events: Owner management
CREATE POLICY "Owners can manage events" ON events
  FOR ALL USING (
    circle_id IN (
      SELECT circle_id FROM profiles WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- RSVPs: Read access
CREATE POLICY "RSVPs are readable by circle members" ON rsvps
  FOR SELECT USING (
    event_id IN (
      SELECT id FROM events WHERE circle_id IN (
        SELECT circle_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- RSVPs: Member can update their own
CREATE POLICY "Members can update their own RSVPs" ON rsvps
  FOR ALL USING (user_id = auth.uid());

-- Payments: Read access
CREATE POLICY "Payments are readable by members" ON payments
  FOR SELECT USING (
    user_id = auth.uid() OR
    event_id IN (
      SELECT id FROM events WHERE circle_id IN (
        SELECT circle_id FROM profiles WHERE user_id = auth.uid() AND role = 'owner'
      )
    )
  );

-- Payments: Owner can update
CREATE POLICY "Owners can manage payments" ON payments
  FOR UPDATE USING (
    event_id IN (
      SELECT id FROM events WHERE circle_id IN (
        SELECT circle_id FROM profiles WHERE user_id = auth.uid() AND role = 'owner'
      )
    )
  );

-- Announcements: Circle visibility
CREATE POLICY "Announcements are visible to circle members" ON announcements
  FOR SELECT USING (
    circle_id IN (
      SELECT circle_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Announcements: Owner management
CREATE POLICY "Owners can manage announcements" ON announcements
  FOR ALL USING (
    circle_id IN (
      SELECT circle_id FROM profiles WHERE user_id = auth.uid() AND role = 'owner'
    )
  );
