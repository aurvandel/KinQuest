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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Messages Table (Chat/Communication)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  receiver_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
('item_gen_gap', 'Generation Gap Smiles', 'Capture a heart-warming photo of two family members together: one from the oldest generation and one from the youngest generation smiling!', 100, 'Family', 'Users', NULL, NULL, NULL),
('item_family_heirloom', 'Relic of the Elders', 'Locate and photograph a treasured heirloom, a vintage black-and-white family photo, an ancient diary, or a handwritten recipe card.', 80, 'History', 'Heart', NULL, NULL, NULL),
('item_cousins_selfie', 'The Multi-Clan Cousin Shot', 'Take a group selfie with at least three cousins representing at least two different family branches or lineages!', 75, 'Family', 'Camera', NULL, NULL, NULL),
('item_bbq_boss', 'The Grill Master / Feast Chief', 'Snap an action shot of our champion family chef/grill master managing the food, serving beverages, or cutting the reunion cake!', 50, 'Food', 'Flame', NULL, NULL, NULL),
('item_uncanny_lookalikes', 'Uncanny Family Lookalikes', 'Photograph two family members side-by-side who look amazingly alike! Let the AI referee judge the facial similarities.', 60, 'Genetic', 'Laugh', NULL, NULL, NULL),
('item_retro_moves', 'Old School Cool', 'Get an action photo of someone showing off a fun vintage dance move (disco point, hand jive, twist) or wearing a legendary retro outfit!', 70, 'Entertainment', 'Music', NULL, NULL, NULL),
('item_group_hug', 'Group Hug Extravaganza', 'A wide group hug or silly squad picture featuring at least 5 laughing relatives in a single shot!', 90, 'Joy', 'Sparkles', NULL, NULL, NULL),
('item_reunion_recreation', 'Nature Walk Keepsake', 'Find an attractive stone, pinecone, five-pointed leaf, or flower right outside our reunion headquarters venue.', 40, 'Nature', 'Leaf', 40.7829, -73.9654, 500),
('item_family_mascot', 'Reunion Mascot/Pet', 'Take a picture of any pet participating in the reunion, or a warm plush animal/toy brought by the children.', 45, 'Animal', 'Footprints', 40.7812, -73.9665, 1000)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Permissions for PostgREST anon role
-- ============================================
-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon;

-- Grant full CRUD access on all tables to anon role (needed for app functionality)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;

-- Grant read/write access on sequences (for auto-increment IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ============================================
-- Row-Level Security Policies (Optional - for future auth)
-- ============================================
-- These can be enabled later for security if needed
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

