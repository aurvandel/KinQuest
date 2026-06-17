import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Gauge } from 'k6/metrics';

const enduranceDuration = new Trend('endurance_duration');
const enduranceErrors = new Counter('endurance_errors');
const requestsPerSecond = new Gauge('rps');

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

// Endurance test: sustained load over long period
export const options = {
  scenarios: {
    endurance: {
      executor: 'constant-vus',
      vus: __ENV.VU_COUNT || 20,
      duration: __ENV.TEST_DURATION || '10m', // 10 minute endurance test
      gracefulStop: '1m',
    },
  },
  thresholds: {
    'http_req_duration': ['p(90)<2000', 'p(95)<5000', 'p(99)<10000'], // Relaxed for AI processing
    'http_req_failed': ['rate<0.2'],
    'endurance_errors': ['count<500'],
  },
};

function randomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getTestImageBase64() {
  return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
}

let gameItems = null; // Cache game items after first fetch

export default function () {
  const username = `endurance_${randomString(8)}`;
  let userId = `endurance_${__VU}_${__ITER}`; // Local ID as fallback
  let registeredUserId = userId; // Will be updated with server-assigned ID

  group('Endurance - Continuous Player Activity', () => {
    // Register if new user
    if (__ITER === 0) {
      const registerRes = http.post(`${BASE_URL}/api/auth/register`,
        JSON.stringify({
          username,
          displayName: `Endurance${__VU}`,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'EnduranceRegister' },
        }
      );

      const regOk = check(registerRes, {
        'register ok': (r) => r.status === 200 || r.status === 400,
      });
      if (!regOk) {
        enduranceErrors.add(1);
        console.error(`Registration failed: ${registerRes.body}`);
      } else if (registerRes.status === 200) {
        // Extract server-assigned user ID from response
        try {
          const userData = JSON.parse(registerRes.body);
          if (userData.id) {
            registeredUserId = userData.id;
            console.log(`Endurance user registered with server ID: ${registeredUserId}`);
          }
        } catch (e) {
          console.warn('Failed to parse endurance registration response:', e);
        }
      }
    }

    // Get game state
    const gameRes = http.get(`${BASE_URL}/api/game-state`, {
      tags: { name: 'EnduranceGameState' },
    });

    const stateOk = check(gameRes, {
      'game state ok': (r) => r.status === 200,
    });
    if (!stateOk) {
      enduranceErrors.add(1);
      console.error(`Game state failed: ${gameRes.body}`);
    }
    enduranceDuration.add(gameRes.timings.duration);

    // Cache items from game state (fetch once, reuse)
    if (gameRes.status === 200) {
      try {
        const gameState = JSON.parse(gameRes.body);
        if (gameState.items && gameState.items.length > 0 && !gameItems) {
          gameItems = gameState.items;
          console.log(`Cached ${gameItems.length} items for submission testing`);
        }
      } catch (e) {
        console.error('Failed to parse game state:', e);
      }
    }

    sleep(0.5);

    // Submit a photo only if we have items available
    if (gameItems && gameItems.length > 0) {
      const itemIdToUse = gameItems[Math.floor(Math.random() * gameItems.length)].id;
      
      const submissionRes = http.post(`${BASE_URL}/api/verify-submission`,
        JSON.stringify({
          userId: registeredUserId,
          username,
          itemId: itemIdToUse,
          imageBase64: getTestImageBase64(),
          mimeType: 'image/png',
          lat: 34.0522 + (Math.random() - 0.5) * 0.2,
          lng: -118.2437 + (Math.random() - 0.5) * 0.2,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'EnduranceSubmission' },
          timeout: '30s',
        }
      );

      const submissionOk = check(submissionRes, {
        'submission ok': (r) => r.status === 200,
      });
      if (!submissionOk) {
        enduranceErrors.add(1);
        console.error(`Submission failed with status ${submissionRes.status}:`, submissionRes.body);
      }
      enduranceDuration.add(submissionRes.timings.duration);
    } else {
      console.warn('No items available for submission - game state may not be loaded');
      enduranceErrors.add(1);
    }

    sleep(0.5);

    // Get chat history
    const chatRes = http.get(`${BASE_URL}/api/chat-history`, {
      tags: { name: 'EnduranceChatHistory' },
    });

    check(chatRes, {
      'chat ok': (r) => r.status === 200,
    });

    sleep(1);

    // Post occasional messages
    if (Math.random() > 0.7) {
      const messageRes = http.post(`${BASE_URL}/api/chat`,
        JSON.stringify({
          senderId: registeredUserId,
          senderName: username,
          text: `Endurance test message from ${username}`,
          receiverId: null,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'EnduranceMessage' },
        }
      );

      const msgOk = check(messageRes, {
        'message ok': (r) => r.status === 200 || r.status === 404,
      });
      if (!msgOk) {
        enduranceErrors.add(1);
        console.error(`Message failed: ${messageRes.body}`);
      }
    }

    sleep(2);
  });
}
