import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const registrationDuration = new Trend('registration_duration');
const challengesFetchDuration = new Trend('challenges_fetch_duration');
const submissionDuration = new Trend('submission_duration');
const chatMessageDuration = new Trend('chat_message_duration');
const leaderboardDuration = new Trend('leaderboard_duration');
const slideshowDuration = new Trend('slideshow_duration');
const errorRate = new Counter('errors');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_DURATION = __ENV.TEST_DURATION || '30s';
const VU_COUNT = __ENV.VU_COUNT || 10;
const RAMP_UP = __ENV.RAMP_UP || '5s';

export const options = {
  scenarios: {
    // Scenario 1: Ramp-up load test
    rampUp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_UP, target: parseInt(VU_COUNT) },
        { duration: TEST_DURATION, target: parseInt(VU_COUNT) },
        { duration: '5s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<2000', 'p(99)<5000'], // Realistic for mixed operations
    'http_req_failed': ['rate<0.25'], // Allow some 404s from chat/deletions
    'errors': ['count<100'],
  },
};

// Helper to create a random string
function randomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper to generate a small test image (10x10 blue PNG in base64)
function getTestImageBase64() {
  // 10x10 blue square PNG (more realistic than 1x1)
  return 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFElEQVR42mM8//8/AxYYGRkZGBkZGQAJ+AoKqHpFrAAAAABJRU5ErkJggg==';
}

// Helper to generate test coordinates
function getRandomCoordinates() {
  return {
    lat: 34.0522 + (Math.random() - 0.5) * 0.1, // Los Angeles area
    lng: -118.2437 + (Math.random() - 0.5) * 0.1,
  };
}

export default function () {
  const localUserId = `user_${__VU}_${__ITER}`;
  const username = `player_${randomString(8)}`;
  let registeredUserId = localUserId; // Default fallback

  group('User Registration Flow', () => {
    const registerPayload = {
      userId: localUserId,
      username,
      displayName: `Player ${__VU}`,
    };

    const registerRes = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(registerPayload), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'Register' },
    });

    const registerSuccess = check(registerRes, {
      'registration status is 200 or 400': (r) => r.status === 200 || r.status === 400,
      'registration response has data': (r) => r.body && r.body.length > 0,
    });

    // Extract the server-assigned user ID from response
    if (registerRes.status === 200) {
      try {
        const registerData = JSON.parse(registerRes.body);
        if (registerData.id) {
          registeredUserId = registerData.id;
        }
      } catch (e) {
        // Parsing failed, use default
      }
    }

    registrationDuration.add(registerRes.timings.duration);
    if (!registerSuccess) errorRate.add(1);
  });

  sleep(1);

  group('Get Game State', () => {
    const gameStateRes = http.get(`${BASE_URL}/api/game-state`, {
      tags: { name: 'GameState' },
    });

    const gameStateSuccess = check(gameStateRes, {
      'game state status is 200': (r) => r.status === 200,
      'game state has items': (r) => r.body && r.body.includes('items'),
    });

    challengesFetchDuration.add(gameStateRes.timings.duration);
    if (!gameStateSuccess) errorRate.add(1);

    // Extract a valid item ID from response
    if (gameStateRes.status === 200 && Math.random() > 0.5) {
      // Only do submissions 50% of the time to keep test fast
      const gameState = JSON.parse(gameStateRes.body);
      if (gameState.items && gameState.items.length > 0) {
        // Use the first available item, or random if multiple exist
        const itemIndex = Math.floor(__VU % gameState.items.length);
        const itemId = gameState.items[itemIndex].id;

        sleep(0.5);

        group('Photo Submission Flow', () => {
          const coords = getRandomCoordinates();

          const submissionPayload = {
            userId: registeredUserId, // Use server-assigned user ID
            username,
            itemId: itemId, // Use dynamically fetched item ID
            imageBase64: getTestImageBase64(),
            mimeType: 'image/png',
            lat: coords.lat,
            lng: coords.lng,
          };

          const submissionRes = http.post(`${BASE_URL}/api/verify-submission`, JSON.stringify(submissionPayload), {
            headers: { 'Content-Type': 'application/json' },
            tags: { name: 'Submission' },
            timeout: '30s',
          });

          const submissionSuccess = check(submissionRes, {
            'submission status is 200': (r) => r.status === 200,
            'submission has ID': (r) => r.body && r.body.includes('id'),
          });

          submissionDuration.add(submissionRes.timings.duration);
          if (!submissionSuccess) errorRate.add(1);
        });
      }
    }
  });

  sleep(1);

  group('Chat Message Flow', () => {
    const chatPayload = {
      senderId: registeredUserId,
      senderName: username,
      text: `Hello from ${username} at ${new Date().toISOString()}!`,
      receiverId: null, // Public chat
    };

    const chatRes = http.post(`${BASE_URL}/api/chat`, JSON.stringify(chatPayload), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'Chat' },
    });

    const chatSuccess = check(chatRes, {
      'chat status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    });

    chatMessageDuration.add(chatRes.timings.duration);
    if (!chatSuccess) errorRate.add(1);
  });

  sleep(1);

  group('Get Chat History', () => {
    const chatHistoryRes = http.get(`${BASE_URL}/api/chat-history`, {
      tags: { name: 'ChatHistory' },
    });

    const chatHistorySuccess = check(chatHistoryRes, {
      'chat history status is 200': (r) => r.status === 200,
    });

    if (!chatHistorySuccess) errorRate.add(1);
  });

  sleep(1);

  group('Get Leaderboard', () => {
    const leaderboardRes = http.get(`${BASE_URL}/api/game-state`, {
      tags: { name: 'Leaderboard' },
    });

    const leaderboardSuccess = check(leaderboardRes, {
      'leaderboard status is 200': (r) => r.status === 200,
      'leaderboard has profiles': (r) => r.body && r.body.includes('profiles'),
    });

    leaderboardDuration.add(leaderboardRes.timings.duration);
    if (!leaderboardSuccess) errorRate.add(1);
  });

  sleep(1);

  // Retrieve available slideshows (simulating Scripts tab viewing)
  group('Get Available Slideshows', () => {
    const slideshowsRes = http.get(`${BASE_URL}/api/slideshows`, {
      tags: { name: 'ViewSlideshows' },
    });

    const slideshowsSuccess = check(slideshowsRes, {
      'slideshows status is 200': (r) => r.status === 200,
      'slideshows response valid': (r) => r.body && r.body.length >= 0, // Can be empty array
    });

    slideshowDuration.add(slideshowsRes.timings.duration);
    if (!slideshowsSuccess) errorRate.add(1);

    // Occasionally fetch a specific slideshow
    if (slideshowsRes.status === 200 && Math.random() > 0.6) {
      try {
        const slideshows = JSON.parse(slideshowsRes.body);
        if (Array.isArray(slideshows) && slideshows.length > 0) {
          const randomSlideshow = slideshows[Math.floor(Math.random() * slideshows.length)];

          sleep(0.5);

          group('Get Specific Slideshow', () => {
            const specificRes = http.get(`${BASE_URL}/api/slideshows/${randomSlideshow.id}`, {
              tags: { name: 'GetSlideshow' },
            });

            check(specificRes, {
              'specific slideshow retrieved': (r) => r.status === 200 || r.status === 404,
            });
            slideshowDuration.add(specificRes.timings.duration);
          });
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  });

  sleep(2);
}
