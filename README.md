# KinQuest - Family Reunion Scavenger Hunt App

A real-time, collaborative family reunion scavenger hunt application with AI-powered verification, geolocation challenges, live leaderboards, and interactive maps.

## Features

- **Scavenger Hunt Missions**: Create photo and GPS-based challenges with point rewards
- **AI Judge System**: Google Gemini AI verifies photo submissions in real-time with personalized feedback
- **Geofencing**: GPS-based challenges with configurable radius constraints
- **Live Leaderboard**: Real-time scoring and family member rankings
- **Interactive Map**: View all challenges with geolocation, simulate positions, and track proximity
- **Chat System**: Real-time family communication via WebSocket
- **Admin Controls**: 
  - Create and manage custom missions
  - Configure game settings (title, icon, AI judge criteria)
  - Generate invite codes and QR codes
  - Update geofencing parameters
- **User Permissions**: 
  - Control location sharing, notifications, AI judging level
  - Create and delete personal missions
  - Privacy mode for incognito gameplay
- **Photo Feed**: View all family submissions and community activity

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js Express, WebSocket (ws)
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini API for photo verification
- **Build Tools**: Vite, esbuild
- **Containerization**: Docker & Docker Compose

## Prerequisites

- Node.js 16+
- Docker & Docker Compose (for local Supabase)
- Google Gemini API key
- (Optional) Supabase project for production deployment

## Installation & Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables** in `.env.local`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ADMIN_PASSWORD=your_secure_admin_password
   SUPABASE_URL=http://localhost:8000  # for local dev
   SUPABASE_ANON_KEY=your_anon_key
   ```

3. **Start the local stack:**
   ```bash
   npm run compose:up
   ```
   Compose automatically applies `docker-compose.override.yml`, so nginx is enabled by default.
   This starts:
   - PostgreSQL database (port 5432)
   - PostgREST API (port 8000)
   - Kong API Gateway (port 8000)
   - Node.js app behind nginx
   - nginx reverse proxy (ports 80/443)

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 in your browser

## Build & Deploy

```bash
npm run build
npm run start
```

The app automatically detects database availability and falls back to local JSON storage if needed.

## Project Structure

```
├── src/
│   ├── components/          # React UI components
│   │   ├── MissionsList.tsx      # Scavenger hunt missions display
│   │   ├── GameMap.tsx           # Interactive geolocation map
│   │   ├── Leaderboard.tsx       # Real-time scores
│   │   ├── Chat.tsx              # WebSocket chat
│   │   ├── AdminSettingsModal.tsx # Admin configuration
│   │   └── ...
│   ├── App.tsx              # Main app shell
│   ├── types.ts             # TypeScript interfaces
│   └── index.css            # Global styles
├── server.ts                # Express API & WebSocket server
├── db-manager.ts            # Database layer (Supabase + fallback)
├── password-manager.ts      # Admin authentication
├── docker-compose.yml       # Local development stack
├── supabase/init.sql        # Database schema
└── Dockerfile              # Container configuration
```

## Key Features Explained

### Mission Creation & Management
- Create custom hunts with photo or GPS geofencing
- Set point values, categories, and difficulty
- Delete missions (admins can delete any, users can delete their own)
- Optional geofence radius (in meters)

### AI Verification
- Photos submitted by family members are evaluated by Gemini
- AI provides personalized feedback and bonus points for family spirit
- Status tracking: pending → approved/rejected

### Geolocation System
- Real GPS tracking with fallback to simulated coordinates
- Proximity alerts when near challenges
- Distance calculation in real-time
- Configurable geofence radius per mission

### Admin Dashboard
- Manage game branding (name, icon)
- Set default geolocation center and radius
- Configure AI judge personality/criteria
- Generate and share invite codes
- Display QR code for easy joining

## Database Schema

Key tables:
- **profiles**: User accounts, roles, permissions, scores
- **items**: Scavenger hunt challenges (missions)
- **submissions**: Photo proof submissions with AI verification status
- **messages**: Real-time chat messages

## API Endpoints

- `POST /api/register` - Create user account
- `POST /api/challenges` - Create mission
- `DELETE /api/challenges/:id` - Delete mission
- `POST /api/verify-submission` - Submit photo for AI verification
- `DELETE /api/submissions/:id` - Delete submission
- `WebSocket /api/chat` - Real-time chat connection

## Development Notes

- The app uses both Supabase and local JSON fallback
- WebSocket handles real-time features (chat, online status)
- Missions are stored with creator ID for permission management
- All API responses include error details for debugging

## Internet Toggle For Tile Downloads

If your KinQuest host has internet on `wlan0` but your local game network is on `eth0`, you can quickly enable/disable internet sharing for clients:

```bash
./scripts/toggle-internet.sh on eth0 wlan0
./scripts/toggle-internet.sh status eth0 wlan0
./scripts/toggle-internet.sh off eth0 wlan0
```

What this script does:
- Enables/disables `net.ipv4.ip_forward`
- Adds/removes `iptables` NAT (`MASQUERADE`) on the WAN interface
- Adds/removes forwarding rules between LAN and WAN interfaces

Notes:
- It auto-elevates with `sudo` if needed.
- Defaults are `eth0` (LAN) and `wlan0` (WAN), so `./scripts/toggle-internet.sh on` usually works.

### Tile Upstream Reliability Tuning

If you see repeated logs like `[TileCache] labels miss ... upstream unavailable`, tune these env vars for slower links:

```env
TILE_UPSTREAM_TIMEOUT_MS=5000
TILE_UPSTREAM_RETRIES=1
TILE_WARN_THROTTLE_MS=30000
```

- `TILE_UPSTREAM_TIMEOUT_MS`: Per-attempt timeout.
- `TILE_UPSTREAM_RETRIES`: Additional retries after the first attempt.
- `TILE_WARN_THROTTLE_MS`: Minimum interval between similar warning logs.

## Future Enhancements

- Team-based competitions
- Custom challenge templates
- Bonus challenges and achievements
- Photo filters and AR features
- Mobile app native versions
- Twilio SMS notifications
