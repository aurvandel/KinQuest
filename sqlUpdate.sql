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
ON CONFLICT (id) DO NOTHING;
