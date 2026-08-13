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
  booted_at TIMESTAMPTZ,
  tutorial_completed BOOLEAN DEFAULT FALSE,
  tutorial_completed_at TIMESTAMPTZ
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
  enforce_geofence BOOLEAN DEFAULT TRUE,
  created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE items ADD COLUMN IF NOT EXISTS enforce_geofence BOOLEAN DEFAULT TRUE;

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
  created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON slideshows TO anon;

-- ============================================
-- Saved AI Mission Slideshow Plans
-- ============================================
CREATE TABLE IF NOT EXISTS mission_slideshow_plans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  mission_slides_script TEXT NOT NULL,
  render_plan JSONB,
  mission_card_plans JSONB NOT NULL DEFAULT '[]'::JSONB,
  mission_card_images JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON mission_slideshow_plans TO anon;

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
CREATE INDEX IF NOT EXISTS idx_mission_slideshow_plans_created_by ON mission_slideshow_plans(created_by);
CREATE INDEX IF NOT EXISTS idx_mission_slideshow_plans_created_at ON mission_slideshow_plans(created_at DESC);

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
-- Stewart Family Missions
('item_stewart_rocket', 'By The Rocket', 'Grant was drafted in the military but was rejected because he had a squeaky knee and flat feet. He chose a job testing ammunition for the military. Take a picture by the rocket.', 30, 'Stewart Legacy', 'Parachute', NULL, NULL, NULL),
('item_stewart_magic_pot', 'Magic Soup Pot', 'Geneel made the best homemade soup with her magic soup pot. Find Marilyn and take a picture with the authentic magic pot.', 25, 'Stewart Legacy', 'Pot', NULL, NULL, NULL),
('item_stewart_basketball', 'Center Court', 'Grant was the center of his high school basketball team. Take a picture with the basketball courts in the background.', 25, 'Stewart Legacy', 'Basketball', NULL, NULL, NULL),
('item_stewart_root_beer', 'Root Beer Bench', 'Grant and Geneel loved to make homemade root beer for family occasions. Go to the bench by the tree and take your picture with the dads root beer bottle.', 25, 'Stewart Legacy', 'Glass', NULL, NULL, NULL),
('item_stewart_christmas', 'Christmas Sweatshirts', 'Geneel loved Christmas. She owned several Christmas sweatshirts and wore them proudly. Find Ileen and take a picture with the sweatshirts.', 20, 'Stewart Legacy', 'Gift', NULL, NULL, NULL),
('item_stewart_deer_hunt', 'Orange Hunter', 'Grant loved to deer hunt. Geneel disliked deer meat. Find a person wearing orange and take a picture with them.', 20, 'Stewart Legacy', 'Tree', NULL, NULL, NULL),
('item_stewart_popcorn', 'Bonanza Popcorn Toss', 'Every Sunday evening Grant and Geneel and their children would pop popcorn and watch Bonanza. Go to the northeast corner of the quad and take a picture with popcorn in the air.', 35, 'Stewart Legacy', 'Popcorn', NULL, NULL, NULL),
('item_stewart_three_bears', 'Three Bears Story', 'Geneel loved to read Goldilocks and the Three Bears to her grandchildren. Go to the three bears and take a picture.', 20, 'Stewart Legacy', 'Book', NULL, NULL, NULL),
('item_stewart_briefcase', 'Depot Briefcase', 'Grant worked at the Tooele Ordinance Depot and Tooele Army Depot in the Civil Service Personnel Department for over 30 years. Find the family briefcase he took to work and take a picture with it.', 30, 'Stewart Legacy', 'Briefcase', NULL, NULL, NULL),
('item_stewart_love_note', 'Fourth Grade Love Note', 'Geneel was a school teacher. She once received a love note from a fourth-grade student who said he wanted to marry her. Take a picture with the youngest in your group expressing love.', 25, 'Stewart Legacy', 'Heart', NULL, NULL, NULL),
('item_stewart_byu', 'BYU Letters', 'Grant graduated from BYU. Take a picture of your group using the letters B, Y, or U.', 20, 'Stewart Legacy', 'Flag', NULL, NULL, NULL),
('item_stewart_bear_lake', 'Bear Lake Condos', 'In 1979 Grant and Geneel purchased two Bear Lake condos. Take a picture with the words Bear Lake.', 20, 'Stewart Legacy', 'Sign', NULL, NULL, NULL),
('item_stewart_japan', 'Japan Dinner Table', 'Grant and Geneel took their family to Japan for two years. Find the sibling born there, get chopsticks, sit at a table, and take a photo pretending to eat dinner.', 35, 'Stewart Legacy', 'Globe', NULL, NULL, NULL),
('item_stewart_playground', 'Ideal Beach Playground', 'Grant and Geneel loved watching their posterity play on Ideal Beach playground equipment. Take a picture at the playground.', 20, 'Stewart Legacy', 'Playground', NULL, NULL, NULL),
('item_stewart_shells', 'Five Shells', 'Geneel loved collecting sea shells whenever she went on vacation. Find five shells and take a picture of your group with the shells.', 25, 'Stewart Legacy', 'Water', NULL, NULL, NULL)
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

