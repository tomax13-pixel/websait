-- Add created_by column to circles if not exists (for tracking ownership)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'circles' AND column_name = 'created_by') THEN
        ALTER TABLE circles ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- RPC for Create Circle (Bypass RLS)
CREATE OR REPLACE FUNCTION create_circle_secure(c_name text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Run as database owner
AS $$
DECLARE
  new_id uuid;
  new_code text;
BEGIN
  -- Generate simple random code
  new_code := upper(substring(md5(random()::text) from 1 for 8));
  
  INSERT INTO circles (name, join_code, created_by)
  VALUES (c_name, new_code, auth.uid())
  RETURNING id INTO new_id;
  
  RETURN jsonb_build_object('id', new_id, 'join_code', new_code, 'name', c_name);
END;
$$;

-- RPC for Join Circle (Bypass RLS to find circle by secretive code)
CREATE OR REPLACE FUNCTION join_circle_secure(code text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
