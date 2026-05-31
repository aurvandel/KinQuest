-- ====================================================================
-- WILDERHUNT DOCKER CONTAINER POSTGRES INITIALIZATION SCRIPT
-- Sets up security schemas, routing roles, permissions, and tables.
-- ====================================================================

-- 1. Enable standard postgres extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create standard API roles for PostgREST & Auth integration
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'postgres-super-secure-authenticator-password';
  END IF;
END
$$;

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;

-- 3. Design Core Game Tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  points INTEGER DEFAULT 10,
  category TEXT DEFAULT 'General',
  icon TEXT DEFAULT 'Sparkles',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS public.submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT,
  item_id TEXT REFERENCES public.items(id) ON DELETE CASCADE,
  image_url TEXT,
  status TEXT DEFAULT 'pending',
  ai_explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT,
  sender_name TEXT,
  receiver_id TEXT,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Expose schema 'public' to API roles and grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, authenticator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, authenticator;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, authenticator;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, authenticator;

-- 5. Seed some initial Hunt Items into database
INSERT INTO public.items (id, title, description, points, category, icon, lat, lng, radius)
VALUES
  ('item_retro_key', 'A key with history', 'Locate a physical key. It can be an old door key, house key, padlock key, or retro key. Showcase its details up close.', 50, 'Home', 'Key', NULL, NULL, NULL),
  ('item_qr_code', 'A QR or Barcode', 'Find any QR code or barcode—on a product container, a book cover, a ticket stub, or product label.', 30, 'Tech', 'QrCode', NULL, NULL, NULL),
  ('item_green_leaf', 'Five-pointed leaf', 'Find a fresh green leaf in nature that has multiple lobes/shapes (like maple, ivy, or similar flora).', 40, 'Nature', 'Leaf', 40.7829, -73.9654, 500),
  ('item_yellow_book', 'Yellow cover page book', 'Search your shelves or desks for a book with a primary solid yellow or mostly yellow color schema on the front sleeve.', 60, 'Media', 'BookOpen', NULL, NULL, NULL),
  ('item_cozy_mug', 'Cozy mug or glass of liquid', 'Photograph your current beverage container: a coffee mug, warm tea cup, drinking glass, or insulated bottle.', 25, 'Food', 'Coffee', NULL, NULL, NULL),
  ('item_red_object', 'Something vividly Red', 'Locate any item around you whose prominent dye color is cherry, crimson, or warning red.', 20, 'Creative', 'Palette', NULL, NULL, NULL),
  ('item_desktop_gadget', 'A modern desk widget', 'Find an action-ready piece of hardware like computer mouse, noise-canceling headphones, a controller, or USB accessories.', 35, 'Tech', 'Tv', NULL, NULL, NULL),
  ('item_clock_digit', 'A timepiece showing numbers', 'Capture a wristwatch, smartphone screen clock, desk digital clock, or wall clock to demonstrate the currency of tracking time.', 45, 'Time', 'Clock', 40.7850, -73.9682, 300),
  ('item_houseplant', 'Succulent or houseplant', 'Photograph an active domestic plant, potted greenery, succulent, or flower arrangement inside or on your window sill.', 35, 'Home', 'Flower2', NULL, NULL, NULL),
  ('item_metallic', 'Something metallic', 'Locate a shiny metallic item: cutlery, aluminum wrap, metal gears, or a watch dial gleaming under direct light.', 30, 'Home', 'Sparkles', NULL, NULL, NULL),
  ('item_coin_metal', 'A circular coin', 'A physical coin of any currency denomination, resting flat. It could be cents, pence, euros, or vintage tokens.', 40, 'Finance', 'Coins', NULL, NULL, NULL),
  ('item_furry_pet', 'A furry friend (or portrait)', 'Photograph a real pet (dog, cat, rabbit) or get creative with a stuffed animal, a toy dinosaur, or pet portrait illustration.', 65, 'Animal', 'Footprints', 40.7812, -73.9665, 1000)
ON CONFLICT (id) DO NOTHING;
