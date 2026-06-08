import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const peakLoadDuration = new Trend('peak_load_duration');
const peakErrorRate = new Counter('peak_errors');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const REUNION_ID = __ENV.REUNION_ID || 'reunion_k6_test'; // Test reunion ID

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
  const username = `spike_${randomString(8)}`;
  let userId = `spike_user_${__VU}_${__ITER}`; // Local ID as fallback
  let registeredUserId = userId; // Will be updated with server-assigned ID

  group('Spike Load - Register User', () => {
    const registerRes = http.post(`${BASE_URL}/api/auth/register`, 
      JSON.stringify({
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
    
    if (!success) {
      peakErrorRate.add(1);
      console.error(`Registration failed: ${registerRes.status} - ${registerRes.body}`);
    } else if (registerRes.status === 200) {
      // Extract server-assigned user ID from response
      try {
        const userData = JSON.parse(registerRes.body);
        if (userData.id) {
          registeredUserId = userData.id;
          console.log(`User registered with server ID: ${registeredUserId}`);
        }
      } catch (e) {
        console.warn('Failed to parse registration response to extract ID:', e);
      }
    }
  });

  sleep(1); // Wait longer for profile to be written to database

  group('Spike Load - Get Game State', () => {
    const gameRes = http.get(`${BASE_URL}/api/game-state`, {
      tags: { name: 'SpikeGameState' },
    });

    const success = check(gameRes, {
      'game state ok': (r) => r.status === 200,
    });
    if (!success) {
      peakErrorRate.add(1);
      console.error(`Game state failed: ${gameRes.status} - ${gameRes.body}`);
    }
    peakLoadDuration.add(gameRes.timings.duration);
  });

  sleep(0.5);

  group('Spike Load - Heavy Submission Load', () => {
    // First get game state to extract valid item IDs
    const gameRes = http.get(`${BASE_URL}/api/game-state`, {
      tags: { name: 'SpikeGameState' },
    });

    if (gameRes.status === 200) {
      try {
        const gameState = JSON.parse(gameRes.body);
        const items = gameState.items || [];
        
        if (items.length > 0) {
          for (let i = 0; i < 3; i++) {
            const itemIndex = (Math.floor(Math.random() * items.length));
            const itemId = items[itemIndex].id;
            
            const submissionRes = http.post(`${BASE_URL}/api/verify-submission`,
              JSON.stringify({
                userId: registeredUserId,
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
            if (!success) {
              peakErrorRate.add(1);
              console.error(`Submission failed: ${submissionRes.status} - ${submissionRes.body}`);
            }
            peakLoadDuration.add(submissionRes.timings.duration);

            sleep(0.1);
          }
        } else {
          console.warn('No items available for submission in spike test');
          peakErrorRate.add(1);
        }
      } catch (e) {
        console.error('Failed to parse game state in spike test:', e);
        peakErrorRate.add(1);
      }
    } else {
      console.error(`Failed to fetch game state for spike submissions: ${gameRes.status}`);
      peakErrorRate.add(1);
    }
  });

  sleep(1);
}
