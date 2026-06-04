# KinQuest PWA Testing Guide

All PWA components are now fully configured and deployed. Follow these steps to test the installation functionality.

## Quick Verification Checklist

### Server Status ✅
- [x] manifest.json served at `http://localhost:3000/manifest.json`
- [x] Service worker available at `http://localhost:3000/service-worker.js`
- [x] All icons generated: icon-96x96, icon-192x192, icon-512x512 (+ maskable variants)
- [x] HTML includes PWA meta tags and manifest link
- [x] Service worker registration in place (src/main.tsx)

---

## Testing Installation Prompt

### Step 1: Clear Browser Cache
This ensures the browser recognizes the app as installable from scratch:

**Chrome/Edge/Brave:**
- Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
- Select "All time" for time range
- Check: Cookies and cached images, Cached files
- Click "Clear data"

**Firefox:**
- Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
- Click "Clear Now"

### Step 2: Open the App
1. Navigate to `http://localhost:3000` in your browser
2. Wait 2-3 seconds for service worker to register
3. Open DevTools console (F12)

### Step 3: Check Console Logs
Look for these messages confirming proper PWA setup:

```
[PWA] Service Worker registered successfully: ServiceWorkerRegistration {...}
[PWA] Install prompt is ready
```

**If you see these messages**: Your browser has recognized the app as installable! Continue to Step 4.

**If you don't see these messages**: 
- Check the "Issues" tab in DevTools
- Look for any CORS errors related to manifest.json
- Verify manifest.json loads (Network tab → Filter "manifest")

### Step 4: Look for Install Button

**Chrome/Brave/Edge on Desktop:**
- Look in the address bar (far right) for a **small icon** (usually looks like ⬇️ or 🔧)
- Or go to **Browser Menu (⋮) → "Install KinQuest"**

**Chrome on Android:**
- Look for **"Install" banner** at the top of the page
- Or go to **Browser Menu (⋮) → "Install app"**

**Samsung Internet on Android:**
- Go to **Menu (☰) → "Add to Home screen"**

**Firefox (Limited Support):**
- PWA installation not fully supported (shows as "Add to Home screen" on mobile)

### Step 5: Click Install
When you see the install prompt:
1. Click the install button
2. Confirm any browser prompts
3. App will be installed to your system

### Step 6: Verify Installation
After installation:

**Desktop (Chrome/Edge/Brave):**
- App appears in your applications menu
- Click the app icon to launch it
- App runs in standalone mode (no browser chrome visible)

**Android (Chrome/Samsung):**
- App icon appears on home screen
- Click to launch in fullscreen standalone mode

---

## Testing Service Worker & Offline Functionality

### Step 1: Open DevTools → Application Tab
1. Open DevTools (F12)
2. Click the **"Application"** tab
3. On the left sidebar, click **"Service Workers"**

### Step 2: Verify Service Worker
You should see:
```
http://localhost:3000/service-worker.js
Status: activated and running
```

If status shows **"waiting to activate"**: Refresh the page once.

### Step 3: Test Offline
1. Open DevTools → **Network** tab
2. Check the **"Offline"** checkbox (usually bottom-left)
3. Try navigating the app - it should still work (using cached assets)
4. Try accessing the map or submitting photos - will fail gracefully with offline message
5. Uncheck **"Offline"** to resume normal operation

### Step 4: Check Cache Storage
1. Open DevTools → Application tab
2. On left sidebar, expand **"Cache storage"**
3. You should see caches like:
   - `kinquest-v1-static` (HTML, CSS, JS)
   - `kinquest-v1-images` (cached images)
   - `kinquest-v1-api` (cached API responses)

---

## Manifest Verification

### Step 1: Check Manifest Loading
1. Open DevTools → **Application** tab
2. On left sidebar, click **"Manifest"**
3. Verify you see:
   ```json
   {
     "name": "KinQuest - Family Reunion Scavenger Hunt",
     "short_name": "KinQuest",
     "display": "standalone",
     "start_url": "/",
     "theme_color": "#5a5a40"
   }
   ```

### Step 2: Verify Icons
In the same Manifest view, scroll down to **Icons** section:
- [ ] icon.svg (any size)
- [ ] icon-192x192.png (192x192)
- [ ] icon-192x192-maskable.png (192x192, maskable)
- [ ] icon-512x512.png (512x512)
- [ ] icon-512x512-maskable.png (512x512, maskable)

All icons should be **green checkmarks** ✅

---

## Troubleshooting

### Installation Button Doesn't Appear

**Problem:** No install button visible in address bar or menu

**Solutions:**

1. **Clear cache again** (sometimes browser needs a hard refresh):
   ```bash
   Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
   ```

2. **Check manifest validity:**
   - Open DevTools → Application → Manifest
   - Look for any red error messages
   - Verify `"display": "standalone"` is present

3. **Verify HTTPS or localhost:**
   - PWAs require HTTPS in production (localhost works in development)
   - If testing on phone, ensure you're using `http://` on localhost

4. **Check service worker status:**
   - Go to Application → Service Workers
   - Status should be **"activated and running"**
   - If it shows "failed", there's an error in the service worker file

5. **Browser compatibility:**
   - Chrome/Brave/Edge: Full support
   - Firefox: Limited support (desktop install only)
   - Safari: Limited support (adds to home screen on iOS)

### Icons Not Showing

**Problem:** Manifest shows red ❌ for icons

**Solutions:**

1. **Verify icons exist:**
   ```bash
   ls -la /home/parker/KinQuest/public/icon-*
   ```

2. **Check if icons are served:**
   ```bash
   curl -I http://localhost:3000/icon-192x192.png
   # Should show "HTTP/1.1 200 OK"
   ```

3. **Regenerate icons:**
   ```bash
   cd /home/parker/KinQuest
   npm run build
   docker compose restart kinquest-app
   ```

### Service Worker Not Registering

**Problem:** Console shows `[PWA] Service Worker registration failed`

**Solutions:**

1. **Check console error message** - look for details about what failed

2. **Verify service-worker.js exists:**
   ```bash
   curl -I http://localhost:3000/service-worker.js
   # Should show HTTP 200
   ```

3. **Check for CORS issues:**
   - DevTools Console → look for CORS error messages
   - Service worker must be served from same origin

4. **Verify service worker syntax:**
   ```bash
   npm run build
   # Check for any TypeScript/bundling errors
   ```

---

## Advanced Testing

### Periodic Update Check
The service worker checks for updates every 60 seconds:
1. Make a code change to `src/main.tsx`
2. Run `npm run build`
3. Restart the app with `docker compose restart kinquest-app`
4. Keep the app open in browser
5. Within 60 seconds, you should see `[PWA] Service Worker updated` in console

### Web App Shortcuts
Once installed, right-click the app icon to see shortcuts:
- **View Missions** - Opens missions tab
- **Check Leaderboard** - Opens leaderboard
- **View Map** - Opens interactive map

### Share Target
On Android with the app installed:
1. Open another app (e.g., file manager or camera)
2. Try to "Share" a photo
3. KinQuest should appear as a sharing destination
4. Sharing will open the app with the photo ready to upload

---

## Success Indicators

You'll know the PWA is working correctly when:

✅ Install button appears in browser UI (address bar or menu)
✅ App can be installed as a standalone application
✅ Installed app runs fullscreen without browser chrome
✅ Service worker shows "activated and running"
✅ `[PWA] Service Worker registered successfully` appears in console
✅ Cache storage has multiple cache stores visible
✅ App works offline (with graceful degradation for API calls)
✅ Icons display correctly when installed

---

## Browser Support

| Browser | Desktop | Mobile | Install Support |
|---------|---------|--------|-----------------|
| Chrome | ✅ | ✅ | Full |
| Edge | ✅ | ✅ | Full |
| Brave | ✅ | ✅ | Full |
| Firefox | ⚠️ | ❌ | Partial |
| Safari | ❌ | ⚠️ | Limited |
| Samsung Internet | N/A | ✅ | Full |

---

## Quick Test Commands

```bash
# Verify app is running
curl -s http://localhost:3000/manifest.json | head -5

# Check service worker
curl -I http://localhost:3000/service-worker.js

# Verify icons exist
ls -lh /home/parker/KinQuest/public/icon-*.png

# Check build status
npm run build

# Restart deployment
docker compose restart kinquest-app && sleep 2 && curl -I http://localhost:3000
```

---

**Last Updated:** June 4, 2026
**Status:** All PWA components deployed and verified working

