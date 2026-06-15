-- WilderHunt Supabase Local Initialization Script
-- Execute this schema inside your Supabase Project SQL Editor or Docker container

-- ============================================
-- Role Setup for PostgREST
-- ============================================
-- Create the authenticator role (used by PostgREST)
CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'postgres-super-secure-authenticator-password';

-- Create the anon role (for public/unauthenticated requests)
CREATE ROLE anon NOINHERIT;

-- Grant anon role to authenticator
GRANT anon TO authenticator;

-- ============================================
-- Enable UUID extension
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Set Default Privileges for Future Tables
-- ============================================
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon;

-- ============================================
-- Profiles Table (User Management)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  permissions JSONB DEFAULT '{}'::jsonb,
  score INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_muted BOOLEAN DEFAULT FALSE,
  muted_until TIMESTAMPTZ,
  is_booted BOOLEAN DEFAULT FALSE,
  booted_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO anon;

-- ============================================
-- Items Table (Scavenger Hunt Challenges)
-- ============================================
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  points INTEGER DEFAULT 10,
  category TEXT DEFAULT 'General',
  icon TEXT DEFAULT 'Sparkles',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius DOUBLE PRECISION,
  created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON items TO anon;

-- ============================================
-- Submissions Table (Hunter Proof/Evidence)
-- ============================================
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ai_explanation TEXT,
  points_awarded INTEGER DEFAULT 0,
  forced_approval BOOLEAN DEFAULT FALSE,
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION,
  retry_count INTEGER DEFAULT 0,
  retry_reason TEXT CHECK (retry_reason IN ('rate_limit', 'timeout', 'error')),
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON submissions TO anon;

-- ============================================
-- Messages Table (Chat/Communication)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  receiver_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE
);

GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO anon;

-- ============================================
-- Slideshows Table (AI-Generated Slideshow Scripts)
-- ============================================
CREATE TABLE IF NOT EXISTS slideshows (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  script TEXT NOT NULL,
  submission_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON slideshows TO anon;

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_created_by ON items(created_by);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_item_id ON submissions(item_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slideshows_created_by ON slideshows(created_by);
CREATE INDEX IF NOT EXISTS idx_slideshows_is_published ON slideshows(is_published);
CREATE INDEX IF NOT EXISTS idx_slideshows_created_at ON slideshows(created_at DESC);

-- ============================================
-- Grant Sequence Permissions
-- ============================================
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO anon;

-- ============================================
-- Initial Admin User (Optional)
-- ============================================
INSERT INTO profiles (id, username, display_name, role, score, completed_count, created_at)
VALUES (
  'user_admin',
  'admin',
  'Grand Host Admin',
  'admin',
  0,
  0,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Initial Scavenger Hunt Items (Optional Seed Data)
-- ============================================
INSERT INTO items (id, title, description, points, category, icon, lat, lng, radius) VALUES
-- Grandpa Grant Missions
('item_grant_fort_ord_clerk', 'Fort Ord Payday', 'Grandpa Grant served at Fort Ord as company clerk and lent money at high interest. Take a picture at the welcome kiosk holding some money.', 45, 'Grandpa Grant', 'Coins', 38.80116, -111.68356, 50),
('item_grant_truck_rawlins', 'Rawlins Recovery Run', 'Grandpa Grant was a truck driver and once had appendix surgery in Rawlins, Wyoming during a trip. Take a picture with one of the trucks in the parking lot.', 30, 'Grandpa Grant', 'Footprints', 38.80104, -111.68362, 25),
('item_grant_wrestling_champ', 'Provo Pin', 'Grandpa Grant pinned the best wrestler on the team twice and later took second at Utah state. Take a picture of wrestling in the rec hall.', 50, 'Grandpa Grant', 'Flag', 38.80039, -111.68339, 20),
('item_grant_hitchhike_home', '1000-Mile Thumb', 'After Army basic training, Grandpa Grant hitchhiked over 1000 miles to get home. Take a picture thumbing for a ride at the ATV parking area.', 35, 'Grandpa Grant', 'Map', 38.80232, -111.68294, 30),
('item_grant_milk_cows', 'Hunting Season Chores', 'As a young boy, Grandpa Grant stayed home to milk cows during deer hunting season. Take a picture with cows in the background.', 30, 'Grandpa Grant', 'Leaf', NULL, NULL, NULL),
('item_grant_dummy_prank', 'Dummy Drop Dash', 'Grandpa Grant and Dick dropped a dummy near Harmon Park, then ran from police and snuck home. Take a picture by the big tree next to the entry road.', 40, 'Grandpa Grant', 'Tree', 38.80193, -111.68305, 50),
('item_grant_overalls_wedding', 'Overalls Forever', 'Grandpa Grant always wore overalls and even wore them to tease Paula at Kirk and Paula''s wedding. Take a picture with the overalls at the water spigot by the bathroom.', 25, 'Grandpa Grant', 'Gift', 38.80103, -111.68292, 20),
('item_grant_rodeo_champion', '18 Wheeler Champion', 'Grandpa Grant won the National 18 Wheeler Rodeo in Minneapolis, Minnesota. Take a picture by the trailer next to cabin 1.', 35, 'Grandpa Grant', 'Parachute', 38.80075, -111.68293, 23),
('item_grant_gold_prospect', 'SanPete Gold Hunt', 'Grandpa Grant loved to prospect for gold and found low-grade ore in SanPete County. Take a picture by the FFA gate with a big rock.', 30, 'Grandpa Grant', 'Coins', NULL, NULL, NULL),

-- Grandma Marcia Missions
('item_marcia_cheerleader', 'Rec Hall Cheer', 'Grandma Marcia was a high school cheerleader. Take a picture at the side of the rec hall cheering for the team.', 25, 'Grandma Marcia', 'Flag', 38.8004, -111.68358, 20),
('item_marcia_salutatorian', 'Salutatorian Spotlight', 'Grandma Marcia graduated as salutatorian of Tooele High School. Take a picture receiving a diploma at the flagpole.', 30, 'Grandma Marcia', 'Book', 38.80102, -111.68332, 25),
('item_marcia_brick_builder', 'Brick Builder', 'Grandma Marcia carried bricks while pregnant with Kirk during the Orem home build. Take a picture by the bathroom with an armload of rocks.', 40, 'Grandma Marcia', 'Pot', 38.8009, -111.68297, 20),
('item_marcia_fire_rescue', 'Fire Escape Story', 'Grandma Marcia was trapped in a burning car after being rear-ended until John Roach broke the window and pulled her out. Take a picture by the fire pit.', 35, 'Grandma Marcia', 'Flame', 38.8015, -111.68392, 40),
('item_marcia_seamstress', 'Wedding Dress Maker', 'Grandma Marcia was an amazing seamstress who designed and sewed her own wedding dress and winter coats. Take a picture of the group holding the picture near the kitchen.', 35, 'Grandma Marcia', 'Heart', 38.80059, -111.68308, 15),
('item_marcia_quarry_blast', 'Quarry Boom', 'Grandma Marcia hated blasting at the picture rock quarry and cried until John came back into view. Take a picture with your fingers in your ears behind cabin 3.', 30, 'Grandma Marcia', 'VolumeUp', 38.80096, -111.68391, 25),
('item_marcia_irrigation', 'Ditch Crew', 'Grandma Marcia helped change irrigation water by moving the dam and directing water with a shovel. Take a picture with the shovel at the creek by the bridge.', 35, 'Grandma Marcia', 'WaterDrop', 38.80145, -111.68401, 50),
('item_marcia_reading', 'Front Hall Book Time', 'Grandma Marcia read to her children nearly every day and taught a love of reading. Take a picture in front of the rec hall holding a book.', 20, 'Grandma Marcia', 'Book', 38.80071, -111.68344, 20),
('item_marcia_mouse_story', 'Fireplace Mouse Watch', 'Grandma Marcia was not afraid of mice and the family watched one explore the fireplace wall. Take a picture holding the mouse by the tail at the side of cabin 4.', 45, 'Grandma Marcia', 'Footprints', 38.80118, -111.68395, 25)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Role Setup for PostgREST (completed at top)
-- ============================================
-- Roles already created and permissions granted at beginning

-- ============================================
-- Row-Level Security Policies (Optional - for future auth)
-- ============================================
-- These can be enabled later for security if needed
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

