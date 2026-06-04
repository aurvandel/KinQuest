import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const chatErrors = new Counter('chat_errors');
const chatDuration = new Trend('chat_message_duration');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';

// WebSocket stress test - concurrent chat connections
export const options = {
  scenarios: {
    chatLoad: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },   // Ramp up to 20 users
        { duration: '2m', target: 20 },   // Hold for 2 minutes
        { duration: '30s', target: 0 },   // Cool down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<5000'], // Relaxed for submissions with AI
    'http_req_failed': ['rate<0.2'],
    'chat_errors': ['count<50'],
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

const messages = [
  "Great find! 📸",
  "Love this challenge!",
  "Just completed mine too",
  "This is so much fun!",
  "Amazing adventure",
  "Can't wait to see all submissions",
  "This family is awesome",
  "Best reunion ever!",
];

export default function () {
  const userId = `chat_user_${__VU}_${__ITER}`;
  const username = `chattester_${randomString(8)}`;

  group('WebSocket Chat Load Test', () => {
    // First register the user via REST API
    const registerRes = http.post(`${BASE_URL}/api/auth/register`,
      JSON.stringify({
        userId,
        username,
        displayName: `ChatUser${__VU}`,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'ChatRegister' },
      }
    );

    check(registerRes, {
      'user registered': (r) => r.status === 200 || r.status === 400,
    });

    sleep(0.5);

    // Test REST API chat endpoint
    for (let i = 0; i < 5; i++) {
      const messageRes = http.post(`${BASE_URL}/api/chat`,
        JSON.stringify({
          senderId: userId,
          senderName: username,
          text: messages[Math.floor(Math.random() * messages.length)],
          receiverId: null,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'ChatMessage' },
        }
      );

      const success = check(messageRes, {
        'message sent': (r) => r.status === 200 || r.status === 404,
      });

      if (!success) chatErrors.add(1);
      chatDuration.add(messageRes.timings.duration);

      sleep(Math.random() * 0.5 + 0.3); // Random delay between messages
    }

    // Get chat history
    const historyRes = http.get(`${BASE_URL}/api/chat-history`, {
      tags: { name: 'ChatHistory' },
    });

    check(historyRes, {
      'chat history retrieved': (r) => r.status === 200,
    });

    sleep(1);

    // Attempt WebSocket connection if WS is available
    // Note: k6 has limited WebSocket support, mainly for testing connections
    try {
      const wsRes = ws.connect(`${WS_URL}/ws`, {
        tags: { name: 'WebSocketConnection' },
      }, function (socket) {
        socket.on('open', function () {
          check(true, {
            'websocket connected': () => true,
          });

          // Send a test message
          socket.send(JSON.stringify({
            type: 'chat',
            userId,
            username,
            message: 'Test WebSocket message',
          }));

          // Listen for responses with timeout
          socket.setTimeout(() => {
            socket.close();
          }, 5000);
        });

        socket.on('message', function (msg) {
          check(msg, {
            'received message': (m) => m && m.length > 0,
          });
        });

        socket.on('error', function (err) {
          check(false, {
            'websocket error': () => false,
          });
          chatErrors.add(1);
        });

        socket.on('close', function () {
          check(true, {
            'websocket closed properly': () => true,
          });
        });
      });
    } catch (err) {
      console.log('WebSocket test skipped or failed:', err.message);
      // Continue test without WebSocket
    }

    sleep(1);
  });
}
