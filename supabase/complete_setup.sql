-- =============================================================================
-- サークル結 (Circle Knot) - Complete Database Setup
-- =============================================================================
-- このファイルを Supabase SQL Editor で一度だけ実行してください。
-- すべてのテーブル、関数、ポリシーを作成します。
-- =============================================================================

-- ===========================
-- 1. テーブル作成
-- ===========================

-- circles テーブル
CREATE TABLE IF NOT EXISTS circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- profiles テーブル
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- events テーブル
CREATE TABLE IF NOT EXISTS events (
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

-- rsvps テーブル
CREATE TABLE IF NOT EXISTS rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
  comment TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- payments テーブル
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('unpaid', 'paid')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- announcements テーブル
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- owner_invites テーブル
CREATE TABLE IF NOT EXISTS owner_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================
-- 2. RLS 有効化
-- ===========================

ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_invites ENABLE ROW LEVEL SECURITY;

-- ===========================
-- 3. ヘルパー関数
-- ===========================

-- ユーザーの circle_id を取得（無限再帰を回避するため SECURITY DEFINER を使用）
CREATE OR REPLACE FUNCTION get_my_circle_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT circle_id FROM profiles WHERE user_id = auth.uid();
$$;

-- サークル作成用 RPC（RLSをバイパス）
CREATE OR REPLACE FUNCTION create_circle_secure(c_name text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  new_code text;
BEGIN
  new_code := upper(substring(md5(random()::text) from 1 for 8));
  
  INSERT INTO circles (name, join_code, created_by)
  VALUES (c_name, new_code, auth.uid())
  RETURNING id INTO new_id;
  
  RETURN jsonb_build_object('id', new_id, 'join_code', new_code, 'name', c_name);
END;
$$;

-- サークル参加用 RPC（RLSをバイパス）
CREATE OR REPLACE FUNCTION join_circle_secure(code text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_id uuid;
  found_name text;
BEGIN
  SELECT id, name INTO found_id, found_name
  FROM circles
  WHERE join_code = code;
  
  IF found_id IS NULL THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;
  
  RETURN jsonb_build_object('id', found_id, 'name', found_name);
END;
$$;

-- ===========================
-- 4. 既存ポリシーの削除
-- ===========================

-- profiles
DROP POLICY IF EXISTS "Circle profiles are readable by members" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;

-- circles
DROP POLICY IF EXISTS "Circles are readable by members" ON circles;
DROP POLICY IF EXISTS "Authenticated users can create circles" ON circles;

-- events
DROP POLICY IF EXISTS "Events are readable by circle members" ON events;
DROP POLICY IF EXISTS "Owners can manage events" ON events;

-- rsvps
DROP POLICY IF EXISTS "RSVPs are readable by circle members" ON rsvps;
DROP POLICY IF EXISTS "Members can update their own RSVPs" ON rsvps;
DROP POLICY IF EXISTS "Members can manage their own RSVPs" ON rsvps;

-- payments
DROP POLICY IF EXISTS "Payments are readable by members" ON payments;
DROP POLICY IF EXISTS "Owners can manage payments" ON payments;
DROP POLICY IF EXISTS "Members can insert their own payments" ON payments;
DROP POLICY IF EXISTS "Members can delete their own payments" ON payments;

-- announcements
DROP POLICY IF EXISTS "Announcements are visible to circle members" ON announcements;
DROP POLICY IF EXISTS "Owners can manage announcements" ON announcements;

-- ===========================
-- 5. ポリシー作成
-- ===========================

-- ■ profiles ポリシー
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Circle profiles are readable by members" ON profiles
  FOR SELECT USING (circle_id = get_my_circle_id());

CREATE POLICY "Users can manage own profile" ON profiles
  FOR ALL USING (user_id = auth.uid());

-- ■ circles ポリシー
CREATE POLICY "Circles are readable by members" ON circles
  FOR SELECT USING (id = get_my_circle_id());

-- ■ events ポリシー
CREATE POLICY "Events are readable by circle members" ON events
  FOR SELECT USING (circle_id = get_my_circle_id());

CREATE POLICY "Owners can manage events" ON events
  FOR ALL USING (
    circle_id = get_my_circle_id() AND 
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
  );

-- ■ rsvps ポリシー
CREATE POLICY "RSVPs are readable by circle members" ON rsvps
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE circle_id = get_my_circle_id())
  );

CREATE POLICY "Members can manage their own RSVPs" ON rsvps
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ■ payments ポリシー
CREATE POLICY "Payments are readable by members" ON payments
  FOR SELECT USING (
    user_id = auth.uid() OR
    event_id IN (
      SELECT id FROM events WHERE circle_id = get_my_circle_id() AND
      EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
    )
  );

CREATE POLICY "Owners can manage payments" ON payments
  FOR UPDATE USING (
    event_id IN (
      SELECT id FROM events WHERE circle_id = get_my_circle_id() AND
      EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
    )
  );

CREATE POLICY "Members can insert their own payments" ON payments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members can delete their own payments" ON payments
  FOR DELETE USING (user_id = auth.uid());

-- ■ announcements ポリシー
CREATE POLICY "Announcements are visible to circle members" ON announcements
  FOR SELECT USING (circle_id = get_my_circle_id());

CREATE POLICY "Owners can manage announcements" ON announcements
  FOR ALL USING (
    circle_id = get_my_circle_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
  );

-- =============================================================================
-- 完了！
-- =============================================================================
