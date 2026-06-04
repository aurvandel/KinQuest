import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const peakLoadDuration = new Trend('peak_load_duration');
const peakErrorRate = new Counter('peak_errors');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Spike test: Start low, spike high, return low
export const options = {
  scenarios: {
    spikeTest: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },  // Warm up to 10 users
        { duration: '1m', target: 100 }, // Spike to 100 users
        { duration: '1m', target: 10 },  // Drop back to 10
        { duration: '30s', target: 0 },  // Cool down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<5000', 'p(99)<10000'], // Relaxed for AI processing
    'http_req_failed': ['rate<0.3'], // More lenient during spikes and AI processing
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

export default function () {
  const userId = `spike_user_${__VU}_${__ITER}`;
  const username = `spike_${randomString(8)}`;

  group('Spike Load - Register User', () => {
    const registerRes = http.post(`${BASE_URL}/api/auth/register`, 
      JSON.stringify({
        userId,
        username,
        displayName: `SpikeUser ${__VU}`,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'SpikeRegister' },
      }
    );

    const success = check(registerRes, {
      'registration ok': (r) => r.status === 200 || r.status === 400,
    });
    if (!success) peakErrorRate.add(1);
  });

  sleep(0.5);

  group('Spike Load - Get Game State', () => {
    const gameRes = http.get(`${BASE_URL}/api/game-state`, {
      tags: { name: 'SpikeGameState' },
    });

    const success = check(gameRes, {
      'game state ok': (r) => r.status === 200,
    });
    if (!success) peakErrorRate.add(1);
    peakLoadDuration.add(gameRes.timings.duration);
  });

  sleep(0.5);

  group('Spike Load - Heavy Submission Load', () => {
    // First get game state to extract valid item IDs
    const gameRes = http.get(`${BASE_URL}/api/game-state`, {
      tags: { name: 'SpikeGameState' },
    });

    if (gameRes.status === 200) {
      const gameState = JSON.parse(gameRes.body);
      const items = gameState.items || [];
      
      if (items.length > 0) {
        for (let i = 0; i < 3; i++) {
          const itemIndex = (Math.floor(Math.random() * items.length));
          const itemId = items[itemIndex].id;
          
          const submissionRes = http.post(`${BASE_URL}/api/verify-submission`,
            JSON.stringify({
              userId,
              username,
              itemId: itemId,
              imageBase64: getTestImageBase64(),
              mimeType: 'image/png',
              lat: 34.0522 + Math.random() * 0.1,
              lng: -118.2437 + Math.random() * 0.1,
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              tags: { name: 'SpikeSubmission' },
              timeout: '30s',
            }
          );

          const success = check(submissionRes, {
            'submission ok': (r) => r.status === 200,
          });
          if (!success) peakErrorRate.add(1);
          peakLoadDuration.add(submissionRes.timings.duration);

          sleep(0.1);
        }
      }
    }
  });

  sleep(1);
}
