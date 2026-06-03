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
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  created_at TIMESTAMPTZ DEFAULT NOW()
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
-- 🟢 THE HERITAGE MUSEUM (Physical Heirlooms)
('item_stewart_briefcase', 'The Depot Desk', 'Locate and photograph Grandpa’s briefcase from his days at the Tooele Army Depot!', 20, 'Heirloom', 'Briefcase', NULL, NULL, NULL),
('item_stewart_dress', 'The Teacher’s Look', 'Find Grandma’s teacher dress! Bonus points if a grandkid tries it on for the photo.', 25, 'Heirloom', 'Dress', NULL, NULL, NULL),
('item_stewart_kimono', 'The World Traveler', 'Find the Kimono from Japan and snap a photo of its beautiful patterns.', 30, 'Heirloom', 'Globe', NULL, NULL, NULL),
('item_stewart_hunting', 'The Woodsman', 'Locate the deer hunting clothes and take a photo of someone posing for the hunt!', 20, 'Heirloom', 'Tree', NULL, NULL, NULL),
('item_stewart_christmas', 'Holiday Spirit', 'Find the legendary Christmas shirt and snap a festive photo!', 15, 'Heirloom', 'Gift', NULL, NULL, NULL),
('item_stewart_texts', 'The Guidebooks', 'Find a photo of the Book of Mormon and the Bible together.', 15, 'Heirloom', 'Book', NULL, NULL, NULL),
('item_stewart_flashlight', 'The Searchlight', 'Locate Grandpa’s flashlight—the ultimate tool for any adventure!', 10, 'Heirloom', 'Flashlight', NULL, NULL, NULL),
('item_stewart_whistle', 'The Signal', 'Find the whistle used to gather the troops!', 10, 'Heirloom', 'VolumeUp', NULL, NULL, NULL),
('item_stewart_pot', 'The Feast Pot', 'Find the giant soup pot used for family gatherings.', 15, 'Heirloom', 'Pot', NULL, NULL, NULL),

-- 🟡 TASTE OF TRADITION (Food & Treats)
('item_treat_rootbeer', 'The Family Fizz', 'Capture a photo of some delicious homemade root beer!', 30, 'Treats', 'Glass', NULL, NULL, NULL),
('item_treat_icecream', 'The Chilly Treat', 'Snap a photo of the homemade ice cream before it melts!', 30, 'Treats', 'IceCream', NULL, NULL, NULL),
('item_treat_taffy', 'The Sweet Pull', 'Find the homemade taffy and take a "sweet" photo!', 30, 'Treats', 'Candy', NULL, NULL, NULL),
('item_treat_donuts', 'Morning Delight', 'Locate and photograph a tray of donuts!', 20, 'Treats', 'Donut', NULL, NULL, NULL),
('item_treat_licorice', 'Classic Candy', 'Find the licorice and snap a photo of a piece being eaten!', 20, 'Treats', 'Candy', NULL, NULL, NULL),
('item_treat_popcorn', 'The Movie Snack', 'Find a bowl of popcorn and capture the salty goodness!', 15, 'Treats', 'Popcorn', NULL, NULL, NULL),

-- 🔵 IDEAL RESORT EXPLORATION (Resort Amenities)
('item_resort_basketball', 'The Pro Athlete', 'Take a photo of a family member posing for a "slam dunk" at the basketball court!', 40, 'Resort', 'Basketball', NULL, NULL, NULL),
('item_resort_golf', 'Hole-in-One', 'Snap a photo of someone putting a ball at the mini-golf course!', 40, 'Resort', 'Golf', NULL, NULL, NULL),
('item_resort_playground', 'Playground Peak', 'Capture a photo of the kids (or adults!) conquering the playground equipment!', 30, 'Resort', 'Playground', NULL, NULL, NULL),
('item_resort_view', 'The Ideal View', 'Take a photo of the turquoise water—MUST be taken from the grass or a balcony (Stay off the sand!)', 50, 'Resort', 'Water', NULL, NULL, NULL),
('item_resort_sign', 'The Landmark', 'Find the Ideal Beach Resort signage and snap a group photo in front of it!', 20, 'Resort', 'Sign', NULL, NULL, NULL),
('item_resort_apple', 'The Orchard Shot', 'Find the apple tree in the yard and take a creative nature photo!', 30, 'Resort', 'Apple', NULL, NULL, NULL),

-- 🔴 LEGACY & LORE (Stories and Action)
('item_lore_monster', 'Monster Sighting', 'Stage a photo of someone "spotting" the Bear Lake Monster from a balcony or porch!', 60, 'Legacy', 'Monster', NULL, NULL, NULL),
('item_lore_ephraim', 'The Pioneer Path', 'Capture a photo of someone telling the story of Old Ephraim under the shade of a tree!', 60, 'Legacy', 'Map', NULL, NULL, NULL),
('item_lore_parade', 'The Parade Marshal', 'Take a photo of someone marching like they are leading the 24th of July Pioneer Day Parade!', 70, 'Legacy', 'Flag', NULL, NULL, NULL),
('item_lore_poker', 'High-Stakes Gum', 'Photograph two people playing a game of poker in the shade using pieces of gum as chips!', 80, 'Legacy', 'Cards', NULL, NULL, NULL),
('item_lore_camping', 'The Happy Camper', 'Find some camping gear in the grass and take a "roughing it" photo!', 40, 'Legacy', 'Tent', NULL, NULL, NULL),
('item_lore_ammo', 'The Ammo Load', 'Find the "ammunition" (water guns) ready for battle on the porch!', 50, 'Legacy', 'WaterDrop', NULL, NULL, NULL),

-- 🚀 THE BIG FINALE (High Points)
('item_finale_army', 'The Airborne Infantry', 'Take a slow-motion video or photo of the Parachute Army Men being launched from the balcony!', 100, 'Legacy', 'Parachute', NULL, NULL, NULL)

-- Fun seed items for the family reunion (Feel free to customize or add more!)
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

