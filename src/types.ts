export interface ScavengerItem {
  id: string;
  title: string;
  description: string;
  points: number;
  category: string;
  icon: string;
  lat?: number | null;
  lng?: number | null;
  radius?: number | null; // in meters
  createdBy?: string; // User ID of who created this mission
}

export interface PlayerProfile {
  id: string;
  username: string;
  displayName?: string;
  score: number;
  completedCount: number;
  createdAt: string;
  role?: "user" | "admin";
  permissions?: {
    shareLocation?: boolean;
    allowNotifications?: boolean;
    makePrivate?: boolean;
    extendedAiJudge?: boolean;
  };
}

export interface Submission {
  id: string;
  userId: string;
  username: string;
  itemId: string;
  imageUrl: string;
  status: "pending" | "approved" | "rejected";
  aiExplanation?: string;
  forcedApproval?: boolean;
  createdAt: string;
  userLat?: number | null;
  userLng?: number | null;
  distanceMeters?: number | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string | null; // null for public shoutbox, otherwise target player id
  text: string;
  createdAt: string;
}

export interface Slideshow {
  id: string;
  title: string;
  description?: string;
  script: string;
  submissionIds: string[];
  createdBy: string; // Admin user ID who generated it
  createdAt: string;
  isPublished: boolean;
}

export interface AppSettings {
  name: string;
  icon: string | null;
  defaultLat?: number;
  defaultLng?: number;
  defaultRadius?: number;
  aiPromptCriteria?: string;
  activeInviteCode?: string;
  inviteRequired?: boolean;
  aiVerificationEnabled?: boolean;
  allowForceSubmit?: boolean;
}


export const INITIAL_HUNT_ITEMS: ScavengerItem[] = [
  {
    id: "item_retro_key",
    title: "A key with history",
    description: "Locate a physical key. It can be an old door key, house key, padlock key, or retro key. Showcase its details up close.",
    points: 50,
    category: "Home",
    icon: "Key",
    lat: null,
    lng: null,
    radius: null
  },
  {
    id: "item_qr_code",
    title: "A QR or Barcode",
    description: "Find any QR code or barcode—on a product container, a book cover, a ticket stub, or product label.",
    points: 30,
    category: "Tech",
    icon: "QrCode",
    lat: null,
    lng: null,
    radius: null
  },
  {
    id: "item_green_leaf",
    title: "Five-pointed leaf",
    description: "Find a fresh green leaf in nature that has multiple lobes/shapes (like maple, ivy, or similar flora).",
    points: 40,
    category: "Nature",
    icon: "Leaf",
    lat: 40.7829,
    lng: -73.9654,
    radius: 500 // 500 meters from Central Park center
  },
  {
    id: "item_yellow_book",
    title: "Yellow cover page book",
    description: "Search your shelves or desks for a book with a primary solid yellow or mostly yellow color schema on the front sleeve.",
    points: 60,
    category: "Media",
    icon: "BookOpen",
    lat: null,
    lng: null,
    radius: null
  },
  {
    id: "item_cozy_mug",
    title: "Cozy mug or glass of liquid",
    description: "Photograph your current beverage container: a coffee mug, warm tea cup, drinking glass, or insulated bottle.",
    points: 25,
    category: "Food",
    icon: "Coffee",
    lat: null,
    lng: null,
    radius: null
  },
  {
    id: "item_red_object",
    title: "Something vividly Red",
    description: "Locate any item around you whose prominent dye color is cherry, crimson, or warning red.",
    points: 20,
    category: "Creative",
    icon: "Palette",
    lat: null,
    lng: null,
    radius: null
  },
  {
    id: "item_desktop_gadget",
    title: "A modern desk widget",
    description: "Find an action-ready piece of hardware like premium computer mouse, noise-canceling headphones, a controller, or USB accessories.",
    points: 35,
    category: "Tech",
    icon: "Tv",
    lat: null,
    lng: null,
    radius: null
  },
  {
    id: "item_clock_digit",
    title: "A timepiece showing numbers",
    description: "Capture a wristwatch, smartphone screen clock, desk digital clock, or wall clock to demonstrate the currency of tracking time.",
    points: 45,
    category: "Time",
    icon: "Clock",
    lat: 40.7850,
    lng: -73.9682,
    radius: 300
  },
  {
    id: "item_houseplant",
    title: "Succulent or houseplant",
    description: "Photograph an active domestic plant, potted greenery, succulent, or flower arrangement inside or on your window sill.",
    points: 35,
    category: "Home",
    icon: "Flower2",
    lat: null,
    lng: null,
    radius: null
  },
  {
    id: "item_metallic",
    title: "Something metallic",
    description: "Locate a shiny metallic item: cutlery, aluminum wrap, metal gears, or a watch dial gleaming under direct light.",
    points: 30,
    category: "Home",
    icon: "Sparkles",
    lat: null,
    lng: null,
    radius: null
  },
  {
    id: "item_coin_metal",
    title: "A circular coin",
    description: "A physical coin of any currency denomination, resting flat. It could be cents, pence, euros, or vintage tokens.",
    points: 40,
    category: "Finance",
    icon: "Coins",
    lat: null,
    lng: null,
    radius: null
  },
  {
    id: "item_furry_pet",
    title: "A furry friend (or portrait)",
    description: "Photograph a real pet (dog, cat, rabbit) or get creative with a stuffed animal, a toy dinosaur, or pet portrait illustration.",
    points: 65,
    category: "Animal",
    icon: "Footprints",
    lat: 40.7812,
    lng: -73.9665,
    radius: 1000
  }
];
