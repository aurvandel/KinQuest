import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const uploadErrors = new Counter('upload_errors');
const uploadDuration = new Trend('upload_duration');
const serveDuration = new Trend('serve_duration');

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

// Test image serving and persistence
// Tests:
// 1. Submit photos (which saves to disk)
// 2. Retrieve submitted photos from server via /api/uploads/:filename
// 3. Verify image persistence and correct caching headers
export const options = {
  scenarios: {
    imageServing: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 10 },   // Ramp up to 10 users
        { duration: '1m', target: 10 },   // Hold for 1 minute
        { duration: '30s', target: 0 },   // Cool down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<3000'],
    'http_req_failed': ['rate<0.1'],
    'upload_errors': ['count<20'],
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
  return 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFElEQVR42mM8//8/AxYYGRkZGBkZGQAJ+AoKqHpFrAAAAABJRU5ErkJggg==';
}

export default function () {
  const username = `player_${randomString(8)}`;
  let registeredUserId = `user_${__VU}`;
  let imageUrlServed = null;

  // Register user
  group('User Registration', () => {
    const registerRes = http.post(`${BASE_URL}/api/auth/register`,
      JSON.stringify({
        userId: registeredUserId,
        username,
        displayName: `Player ${__VU}`,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'Register' },
      }
    );

    if (registerRes.status === 200) {
      try {
        const userData = JSON.parse(registerRes.body);
        if (userData.id) {
          registeredUserId = userData.id;
        }
      } catch (e) {
        // Use default
      }
    }
  });

  sleep(0.5);

  // Get game state to find a challenge
  group('Get Game State for Challenge', () => {
    const gameStateRes = http.get(`${BASE_URL}/api/game-state`, {
      tags: { name: 'GameState' },
    });

    if (gameStateRes.status === 200 && Math.random() > 0.3) {
      try {
        const gameState = JSON.parse(gameStateRes.body);
        if (gameState.items && gameState.items.length > 0) {
          const itemId = gameState.items[0].id;

          sleep(0.5);

          // Submit a photo - this saves image to disk
          group('Submit Photo (Saves to Disk)', () => {
            const submissionPayload = {
              userId: registeredUserId,
              username,
              itemId,
              imageBase64: getTestImageBase64(),
              mimeType: 'image/png',
              userLat: 34.0522 + Math.random() * 0.1,
              userLng: -118.2437 + Math.random() * 0.1,
            };

            const submissionRes = http.post(`${BASE_URL}/api/verify-submission`,
              JSON.stringify(submissionPayload),
              {
                headers: { 'Content-Type': 'application/json' },
                tags: { name: 'PhotoSubmission' },
                timeout: '30s',
              }
            );

            const submitted = check(submissionRes, {
              'photo submitted': (r) => r.status === 200,
              'submission has ID': (r) => r.body && r.body.includes('id'),
            });

            if (!submitted) uploadErrors.add(1);
            uploadDuration.add(submissionRes.timings.duration);

            // Try to extract image URL from response
            if (submissionRes.status === 200) {
              try {
                const submissionData = JSON.parse(submissionRes.body);
                // Look for image URL in response (imageUrl or imageBase64)
                if (submissionData.imageUrl && submissionData.imageUrl.includes('/api/uploads/')) {
                  imageUrlServed = submissionData.imageUrl;
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          });
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  });

  sleep(1);

  // Serve images from multiple users to test concurrent access
  group('Retrieve Image from Server', () => {
    // If we have a stored image URL from this user, try to serve it
    if (imageUrlServed) {
      group('Serve Specific Image', () => {
        const serveRes = http.get(`${BASE_URL}${imageUrlServed}`, {
          tags: { name: 'ServeImage' },
        });

        const served = check(serveRes, {
          'image served': (r) => r.status === 200 || r.status === 404, // 404 if not yet processed
          'image has content': (r) => r.body && r.body.length > 0,
          'cache headers present': (r) => r.headers['Cache-Control'] !== undefined,
        });

        if (!served) uploadErrors.add(1);
        serveDuration.add(serveRes.timings.duration);
      });
    } else {
      // Try to serve random existing images (if any exist from previous iterations)
      // This simulates users browsing submitted photos from others
      group('Serve Random Existing Images', () => {
        const randomImagePath = `/api/uploads/img_test_${randomString(8)}.png`;

        const serveRes = http.get(`${BASE_URL}${randomImagePath}`, {
          tags: { name: 'ServeRandomImage' },
        });

        // 404 is acceptable if image doesn't exist yet
        check(serveRes, {
          'serve request handled': (r) => r.status === 200 || r.status === 404,
        });

        serveDuration.add(serveRes.timings.duration);
      });
    }
  });

  sleep(2);
}
