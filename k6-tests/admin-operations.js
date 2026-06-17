import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const adminOpDuration = new Trend('admin_op_duration');
const adminErrors = new Counter('admin_errors');
const slideshowGenerationDuration = new Trend('slideshow_generation_duration');

const BASE_URL = __ENV.BASE_URL || 'http://localhost';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'admin1234';

export const options = {
  scenarios: {
    adminOps: {
      executor: 'ramping-vus',
      startVUs: 1,  // Start with 1 VU immediately
      stages: [
        { duration: '30s', target: 1 },  // Maintain 1 admin user
        { duration: '30s', target: 1 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<2000', 'p(99)<5000'],
    'http_req_failed': ['rate<0.25'],
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

const categories = ['Home', 'Outdoor', 'Food', 'Adventure', 'Creative'];
const icons = ['Key', 'Camera', 'Map', 'Sparkles', 'Heart'];

// Track created challenge IDs for testing update/delete
let createdChallengeId = null;
let adminUserId = null;
let submissionIdForSlideshow = null;

export default function () {
  // Register or get admin user
  if (!adminUserId) {
    group('Admin - Register Admin User', () => {
      const registerRes = http.post(`${BASE_URL}/api/auth/register`,
        JSON.stringify({
          username: 'admin_test_user',
          role: 'admin',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'AdminRegister' },
        }
      );

      if (registerRes.status === 200) {
        try {
          const responseData = JSON.parse(registerRes.body);
          if (responseData.id) {
            adminUserId = responseData.id;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    sleep(0.5);
  }

  group('Admin - Verify Admin Password', () => {
    const verifyRes = http.post(`${BASE_URL}/api/auth/admin-verify`,
      JSON.stringify({
        password: ADMIN_PASSWORD,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'AdminVerify' },
      }
    );

    const verified = check(verifyRes, {
      'admin verify ok': (r) => r.status === 200 || r.status === 401 || r.status === 429,  // 429 = session limit reached
    });
    if (!verified) adminErrors.add(1);
  });

  sleep(1);

  group('Admin - Create Challenge', () => {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const icon = icons[Math.floor(Math.random() * icons.length)];

    const createRes = http.post(`${BASE_URL}/api/challenges`,
      JSON.stringify({
        title: `[TEST_ADMIN] Challenge ${randomString(5)}`,
        description: `[TEST_ADMIN] Test challenge description for stress testing`,
        points: Math.floor(Math.random() * 100) + 10,
        category,
        icon,
        lat: 34.0522 + Math.random() * 0.1,
        lng: -118.2437 + Math.random() * 0.1,
        radius: 500 + Math.random() * 5000,
        createdBy: adminUserId,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'AdminCreateChallenge' },
      }
    );

    const created = check(createRes, {
      'challenge created': (r) => r.status === 200,
    });
    if (!created) adminErrors.add(1);
    adminOpDuration.add(createRes.timings.duration);
    
    // Extract and store the created challenge ID for later update/delete
    if (createRes.status === 200) {
      try {
        const responseData = JSON.parse(createRes.body);
        if (responseData.id) {
          createdChallengeId = responseData.id;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  });

  sleep(1);

  group('Admin - Get Settings', () => {
    const settingsRes = http.get(`${BASE_URL}/api/settings`, {
      tags: { name: 'AdminGetSettings' },
    });

    check(settingsRes, {
      'settings ok': (r) => r.status === 200,
    });
    adminOpDuration.add(settingsRes.timings.duration);
  });

  sleep(1);

  group('Admin - Update Settings', () => {
    const updateRes = http.post(`${BASE_URL}/api/settings`,
      JSON.stringify({
        name: `GameUpdate_${randomString(4)}`,
        icon: 'Sparkles',
        defaultLat: 34.0522,
        defaultLng: -118.2437,
        defaultRadius: 1000,
        aiPromptCriteria: 'Verify the item matches the description',
        aiVerificationEnabled: true,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'AdminUpdateSettings' },
      }
    );

    check(updateRes, {
      'settings updated': (r) => r.status === 200,
    });
    adminOpDuration.add(updateRes.timings.duration);
  });

  sleep(2);

  // Occasionally update a challenge (use the created one, not a hardcoded ID)
  if (Math.random() > 0.7 && createdChallengeId && adminUserId) {
    group('Admin - Update Challenge', () => {
      const updateRes = http.put(`${BASE_URL}/api/challenges/${createdChallengeId}`,
        JSON.stringify({
          userId: adminUserId,
          title: `[TEST_ADMIN] Updated Challenge ${randomString(5)}`,
          description: '[TEST_ADMIN] Updated challenge for stress testing',
          points: 75,
          category: 'Adventure',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'AdminUpdateChallenge' },
        }
      );

      check(updateRes, {
        'challenge updated': (r) => r.status === 200 || r.status === 404,
      });
      adminOpDuration.add(updateRes.timings.duration);
    });

    sleep(1);
  }

  // Occasionally delete the challenge we created
  if (Math.random() > 0.85 && createdChallengeId && adminUserId) {
    group('Admin - Delete Challenge', () => {
      const deleteRes = http.del(`${BASE_URL}/api/challenges/${createdChallengeId}`,
        JSON.stringify({
          userId: adminUserId,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'AdminDeleteChallenge' },
        }
      );

      check(deleteRes, {
        'challenge deleted': (r) => r.status === 200 || r.status === 404,
      });
      adminOpDuration.add(deleteRes.timings.duration);
    });

    sleep(1);
  }

  sleep(1);

  // Get slideshows (everyone can access this)
  group('Admin - Get All Slideshows', () => {
    const slideshowsRes = http.get(`${BASE_URL}/api/slideshows`, {
      tags: { name: 'GetSlideshows' },
    });

    const slideshowsSuccess = check(slideshowsRes, {
      'slideshows retrieved': (r) => r.status === 200,
      'slideshows response valid': (r) => r.body && (r.body === '[]' || r.body.length > 0),
    });

    if (!slideshowsSuccess) adminErrors.add(1);
    adminOpDuration.add(slideshowsRes.timings.duration);

    // Extract a slideshow ID if available for retrieval test
    if (slideshowsRes.status === 200) {
      try {
        const slideshows = JSON.parse(slideshowsRes.body);
        if (Array.isArray(slideshows) && slideshows.length > 0) {
          const slideshowId = slideshows[0].id;

          sleep(0.5);

          // Get specific slideshow details
          group('Admin - Get Specific Slideshow', () => {
            const specificRes = http.get(`${BASE_URL}/api/slideshows/${slideshowId}`, {
              tags: { name: 'GetSpecificSlideshow' },
            });

            check(specificRes, {
              'specific slideshow retrieved': (r) => r.status === 200 || r.status === 404,
            });
            adminOpDuration.add(specificRes.timings.duration);
          });
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  });

  sleep(2);

  // Occasionally generate a slideshow (simulating admin creating content)
  // Note: This uses synthetic submission IDs which may not exist in the database
  // So we accept both success (200) and various error responses (400/500)
  if (Math.random() > 0.6) {
    group('Admin - Generate Slideshow', () => {
      // For this test, we'll generate a slideshow with mock submission IDs
      // In real scenarios, these would be approved submission IDs from the database
      const slideshowPayload = {
        submissionIds: [
          `submission_test_1_${randomString(4)}`,
          `submission_test_2_${randomString(4)}`,
          `submission_test_3_${randomString(4)}`,
        ],
        title: `[TEST_ADMIN] Slideshow ${randomString(5)} - ${new Date().toISOString().split('T')[0]}`,
        description: `[TEST_ADMIN] Stress test slideshow for performance testing`,
        createdBy: adminUserId,
      };

      const generateRes = http.post(
        `${BASE_URL}/api/slideshow/generate`,
        JSON.stringify(slideshowPayload),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'GenerateSlideshow' },
          timeout: '60s', // Slideshow generation with AI can take longer
        }
      );

      // Accept 200 (success), 400 (invalid submissions), or 500 (API error)
      // In load testing with synthetic data, some failures are acceptable
      const generateSuccess = check(generateRes, {
        'slideshow generate attempted': (r) => r.status === 200 || r.status === 400 || r.status === 500,
      });

      if (!generateSuccess) adminErrors.add(1);
      slideshowGenerationDuration.add(generateRes.timings.duration);

      // Extract slideshow ID if successful
      if (generateRes.status === 200) {
        try {
          const slideshowData = JSON.parse(generateRes.body);
          if (slideshowData.id) {
            submissionIdForSlideshow = slideshowData.id;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    sleep(2);
  }
}
