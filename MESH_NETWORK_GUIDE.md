# Mesh Network Architecture for KinQuest

## Overview

The mesh networking system enables **peer-to-peer communication** between phones on the same local network, allowing both **chat messages** and **image uploads** to work completely offline without internet connectivity.

### Key Features

- ✅ **P2P Chat** - Direct messaging between devices without server
- ✅ **P2P Image Sharing** - Upload/share photos peer-to-peer
- ✅ **Automatic Sync** - Queues submissions and syncs when internet returns
- ✅ **WebRTC-based** - Works on same WiFi network using WebRTC data channels
- ✅ **Graceful Fallback** - Works with or without mesh, degrades gracefully
- ✅ **IndexedDB Storage** - Stores large images locally with localStorage fallback
- ✅ **Automatic Reconnect** - Detects internet and syncs pending data
- ✅ **Chunked Transfer** - Handles large base64 images in chunks

---

## Architecture

### 1. **Mesh Network (`src/utils/meshNetwork.ts`)**

Core WebRTC peer-to-peer layer:
- **Peer Discovery**: Connects to peers on local network using STUN servers
- **Data Channels**: Creates ordered, reliable data channels between peers
- **Message Broadcasting**: Supports unicast (direct) and broadcast messaging
- **Chunked Transfer**: Automatically chunks large payloads (>16KB)
- **Heartbeat Monitoring**: Detects and removes dead peers
- **Graceful Degradation**: Continues working even if signaling fails

**Key Methods:**
```typescript
// Connect to a peer
await meshNetwork.connectToPeer(peerId, username);

// Send a message
await meshNetwork.sendMessage("chat" | "submission", payload, receiverId?);

// Listen for messages
meshNetwork.onMessage((msg) => { /* handle */ });

// Get connected peers
const peers = meshNetwork.getConnectedPeers();

// Check if network is active
const isActive = meshNetwork.isNetworkEnabled();
```

### 2. **Submission Queue (`src/utils/meshSubmissionQueue.ts`)**

Local storage for pending image submissions:
- **IndexedDB Storage**: Primary storage for large images
- **LocalStorage Fallback**: Falls back if IndexedDB unavailable
- **Retry Logic**: Tracks retry attempts (max 5)
- **Status Tracking**: Monitors queue progress (queued/syncing/synced/failed)
- **Size Estimation**: Reports queue size and byte count

**Key Methods:**
```typescript
// Add a submission to queue
const submission = await queue.addSubmission(
  userId, username, itemId, imageBase64, lat?, lng?
);

// Get queued submissions
const pending = queue.getQueuedSubmissions();

// Mark as synced when server accepts it
await queue.markAsSynced(submissionId);

// Track progress
const progress = queue.getSyncProgress(); // {total, synced, pending, failed}
```

### 3. **Sync Manager (`src/utils/meshSyncManager.ts`)**

Coordinates synchronization with server when online:
- **Auto-Sync**: Monitors network and syncs when online
- **Retry Logic**: Retries failed submissions up to 5 times
- **Server Sync**: Submits queued images to server for AI verification
- **Peer Sync**: Shares submissions with connected mesh peers
- **Throttling**: Prevents sync spam (10 second minimum interval)
- **Progress Reporting**: Emits events for UI feedback

**Key Methods:**
```typescript
// Automatic sync on reconnection
await syncManager.initialize();

// Manual sync
await syncManager.forceSync();

// Listen for sync events
syncManager.onSyncProgress((progress) => { /* UI update */ });
syncManager.onSyncComplete((results) => { /* show results */ });
syncManager.onSyncError((error) => { /* handle error */ });

// Get status
const status = syncManager.getSyncStatus();
// {isSyncing, lastSyncTime, pendingCount, failedCount}

// Get detailed report
const report = await syncManager.getSyncReport();
```

### 4. **React Hook (`src/utils/useMeshNetwork.ts`)**

Simplified integration into React components:
```typescript
const {
  isInitialized,
  meshEnabled,
  setMeshEnabled,
  connectedPeers,
  syncStatus,
  sendMessage,
  queueSubmission,
  getQueuedSubmissions,
  manualSync,
  getPeers,
  isNetworkEnabled
} = useMeshNetwork({
  username,
  enabled: true,
  onMessage: (msg) => { /* handle */ },
  onPeerConnected: (peer) => { /* UI update */ },
  onSyncComplete: (results) => { /* notify user */ }
});
```

---

## Usage Scenarios

### Scenario 1: Chat Offline on Same WiFi

1. User is on WiFi but no internet (airplane mode on cellular)
2. Mesh network connects to nearby devices
3. Chat messages are sent via P2P through mesh
4. Messages are stored locally and synced when internet returns

### Scenario 2: Submit Photos Without Internet

1. User takes photo of scavenger item
2. No server connection available
3. Photo is queued locally with submission metadata
4. Submission is **not verified** by AI yet (pending)
5. When internet returns:
   - Photo is synced to server
   - AI verification happens on server
   - Result is stored and synced back to device

### Scenario 3: P2P Peer Review

1. One user submits a photo offline
2. Mesh network is active with other peers
3. Photo is shared to connected peers (optional)
4. Peers can provide local feedback before server sync
5. When synced, server AI provides definitive judgment

### Scenario 4: Mixed Network

1. Some users have internet, some don't
2. Online users can relay messages/data to offline users
3. Offline submissions are collected and synced when opportunity arises
4. Creates self-healing network resilience

---

## Integration with App.tsx

### Step 1: Import and Initialize

```typescript
import { useMeshNetwork } from "./utils/useMeshNetwork";

function App() {
  const {
    isInitialized,
    meshEnabled,
    connectedPeers,
    syncStatus,
    queueSubmission,
    manualSync
  } = useMeshNetwork({
    username: profile?.username || "unknown",
    enabled: true,
    onSyncComplete: (results) => {
      // Show user feedback on synced submissions
      console.log("Submissions synced:", results);
    }
  });
}
```

### Step 2: Handle Offline Submission

```typescript
// In handleSubmitForVerification or similar
const handleSubmitForVerification = async (itemId, imageBase64, lat, lng) => {
  if (navigator.onLine) {
    // Normal online flow - send to server immediately
    const response = await fetch("/api/verify-submission", { /* ... */ });
  } else {
    // Offline flow - queue locally
    const queued = await queueSubmission(
      userId, username, itemId, imageBase64, lat, lng
    );
    setSubmissionResult({
      status: "pending",
      message: "Photo saved locally. Will sync when online.",
      submission: queued
    });
  }
};
```

### Step 3: Show Sync Status

```typescript
// In your UI
function SyncIndicator() {
  const { syncStatus, meshEnabled, connectedPeers } = useMeshNetwork({...});

  if (!meshEnabled) return null;

  return (
    <div className="sync-indicator">
      {syncStatus.isSyncing && <Spinner />}
      {syncStatus.pendingCount > 0 && (
        <span>
          {syncStatus.pendingCount} pending submissions waiting for sync
        </span>
      )}
      {connectedPeers.length > 0 && (
        <span>{connectedPeers.length} peers connected</span>
      )}
    </div>
  );
}
```

### Step 4: Manual Sync Button

```typescript
function SyncButton() {
  const { manualSync, syncStatus } = useMeshNetwork({...});

  return (
    <button onClick={manualSync} disabled={syncStatus.isSyncing}>
      {syncStatus.isSyncing ? "Syncing..." : "Sync Now"}
    </button>
  );
}
```

---

## Data Flow Diagrams

### Online Submission Flow (Existing)
```
Photo Captured
    ↓
[App.tsx] → /api/verify-submission
    ↓
[server.ts] → Gemini AI Verification
    ↓
Submission Stored in DB
    ↓
User sees result
```

### Offline Submission Flow (New)
```
Photo Captured
    ↓
No internet? → Queue locally in IndexedDB
    ↓
[MeshSubmissionQueue] stores photo + metadata
    ↓
(Optionally share via mesh to peers)
    ↓
Internet returns? → Auto-sync starts
    ↓
[MeshSyncManager] uploads queued photos
    ↓
[server.ts] → Gemini AI Verification (same as online)
    ↓
Result synced back to device
    ↓
User sees updated result
```

### Mesh Chat Flow
```
User types message
    ↓
No server connection?
    ↓
Send via WebRTC data channel to peers
    ↓
Peers receive and display (local delivery)
    ↓
Message stored locally
    ↓
Internet returns → Sync with server if needed
```

---

## Configuration

### Mesh Network Settings

In `App.tsx` or admin settings:

```typescript
// Enable/disable mesh networking
const [meshNetworkEnabled, setMeshNetworkEnabled] = useState(true);

// STUN servers (in meshNetwork.ts)
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

// Chunk size for large transfers (default 16KB)
const CHUNK_SIZE = 16384;

// Heartbeat interval (default 5s)
const HEARTBEAT_INTERVAL = 5000;

// Max retry attempts (default 5)
const MAX_RETRIES = 5;

// Min sync interval (default 10s)
const MIN_SYNC_INTERVAL = 10000;
```

### Storage Configuration

- **IndexedDB**: Automatically used for large images
- **LocalStorage**: Fallback if IndexedDB unavailable
- **Cache**: Service worker caches images for faster access

---

## Error Handling

### Network Errors
```typescript
useMeshNetwork({
  onSyncError: (error) => {
    // Handle:
    // - "Peer not connected"
    // - "Mesh network not initialized"
    // - "Data channel send failed"
    console.error("Sync error:", error.message);
  }
});
```

### Storage Errors
```typescript
// IndexedDB quota exceeded
if (error.name === "QuotaExceededError") {
  // Clear old cached images or notify user
  await queue.clear();
}
```

### Retry Logic
```typescript
// Submissions automatically retry up to 5 times
// with exponential backoff before marked as failed
const progress = queue.getSyncProgress();
if (progress.failed > 0) {
  // Show "Some submissions failed to sync" to user
  // Provide manual retry button
}
```

---

## Performance Considerations

### Bandwidth
- **Images chunked** in 16KB segments
- **Delays between submissions** (500ms) prevent server overload
- **Throttled syncing** (10s minimum between full syncs)

### Storage
- **IndexedDB**: Can store several hundred photos (100s of MB)
- **LocalStorage**: Limited to ~5-10MB, uses compression
- **Monitor**: `queue.getQueueSizeEstimate()` reports bytes used

### Latency
- **P2P transfers**: ~50-100ms on local WiFi
- **Server sync**: ~500ms-2s per submission (depends on AI verification)

### Battery
- **Heartbeat interval**: 5 seconds (minimal impact)
- **Auto-sync check**: 30 seconds (negligible drain)
- **WebRTC**: Minimal CPU when idle

---

## Troubleshooting

### Peers not discovering each other
1. Ensure both devices on same WiFi network
2. Check browser WebRTC support
3. Verify STUN servers are reachable
4. Check firewall isn't blocking WebRTC

### Images not syncing
1. Check `navigator.onLine` status
2. Verify server is reachable: `fetch("/api/health")`
3. Check IndexedDB quota: `navigator.storage.estimate()`
4. Check browser console for specific error

### Messages arriving out of order
- WebRTC data channels guarantee ordered delivery
- If order seems wrong, check timestamps in message objects

### High memory usage
1. Reduce `CHUNK_SIZE` if needed
2. Clear old submissions: `queue.clear()`
3. Monitor: `queue.getQueueSizeEstimate()`

---

## Future Enhancements

1. **Bluetooth Mesh** - Add Web Bluetooth API support for Android (iOS limitation)
2. **Relay Nodes** - Devices can relay data for extended range
3. **Encryption** - E2E encryption for peer messages
4. **Mesh Routing** - Multi-hop routing for broader network coverage
5. **Bandwidth Optimization** - Image compression before mesh transfer
6. **Peer Verification** - Let trusted peers verify submissions before server
7. **Offline Leaderboard** - Local leaderboard during offline periods

---

## Testing Offline Functionality

### Simulate Offline in DevTools
1. Open Chrome DevTools → Network tab
2. Check "Offline" checkbox
3. Functionality continues to work locally

### Test Mesh Connectivity
1. Open two browser windows (same machine for testing)
2. Enable mesh network in both
3. Send messages between windows
4. Verify WebRTC connection in DevTools → WebRTC stats

### Test Full Sync Cycle
1. Go offline
2. Submit a photo
3. Come back online
4. Watch sync status
5. Verify submission appears in server database

---

## References

- **WebRTC**: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
- **IndexedDB**: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- **Service Workers**: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- **PWA**: https://web.dev/progressive-web-apps/

---

**Last Updated**: June 5, 2026
**Status**: Ready for integration into App.tsx
