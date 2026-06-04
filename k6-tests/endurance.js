import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Gauge } from 'k6/metrics';

const enduranceDuration = new Trend('endurance_duration');
const enduranceErrors = new Counter('endurance_errors');
const requestsPerSecond = new Gauge('rps');

const BASE_URL = __ENV.BASE_URL || 'https://kinquest.narcolepsy.ninja';

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

const itemIds = [
  'item_retro_key',
  'item_qr_code',
  'item_polaroid',
  'item_analog_clock',
  'item_vintage_photo',
];

let gameItems = null; // Cache game items after first fetch

export default function () {
  const userId = `endurance_${__VU}_${__ITER}`;
  const username = `endurance_${randomString(8)}`;

  group('Endurance - Continuous Player Activity', () => {
    // Register if new user
    if (__ITER === 0) {
      const registerRes = http.post(`${BASE_URL}/api/auth/register`,
        JSON.stringify({
          userId,
          username,
          displayName: `Endurance${__VU}`,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'EnduranceRegister' },
        }
      );

      check(registerRes, {
        'register ok': (r) => r.status === 200 || r.status === 400,
      });
    }

    // Get game state
    const gameRes = http.get(`${BASE_URL}/api/game-state`, {
      tags: { name: 'EnduranceGameState' },
    });

    check(gameRes, {
      'game state ok': (r) => r.status === 200,
    });
    enduranceDuration.add(gameRes.timings.duration);

    // Cache items from game state
    if (gameRes.status === 200 && !gameItems) {
      const gameState = JSON.parse(gameRes.body);
      if (gameState.items && gameState.items.length > 0) {
        gameItems = gameState.items;
      }
    }

    sleep(0.5);

    // Submit a photo
    const itemIdToUse = gameItems && gameItems.length > 0 
      ? gameItems[Math.floor(Math.random() * gameItems.length)].id
      : itemIds[Math.floor(Math.random() * itemIds.length)];
      
    const submissionRes = http.post(`${BASE_URL}/api/verify-submission`,
      JSON.stringify({
        userId,
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
    if (!submissionOk) enduranceErrors.add(1);
    enduranceDuration.add(submissionRes.timings.duration);

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
          senderId: userId,
          senderName: username,
          text: `Endurance test message from ${username}`,
          receiverId: null,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'EnduranceMessage' },
        }
      );

      check(messageRes, {
        'message ok': (r) => r.status === 200 || r.status === 404,
      });
    }

    sleep(2);
  });
}
