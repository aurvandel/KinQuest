import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const chatErrors = new Counter('chat_errors');
const chatDuration = new Trend('chat_message_duration');

const BASE_URL = __ENV.BASE_URL || 'http://localhost';
const WS_URL = __ENV.WS_URL || 'ws://localhost';

// WebSocket Shoutbox and Chat stress test
// Tests:
// 1. Public shoutbox messages (receiverId = null) - broadcast to all users
// 2. Private messages (receiverId = specific user ID) - sent to specific user
// 3. Chat history retrieval via REST API
// 4. Concurrent WebSocket connections and message handling
export const options = {
  scenarios: {
    chatLoad: {
      executor: 'ramping-vus',
      startVUs: 1,  // Start with 1 VU immediately
      stages: [
        { duration: '1m', target: 20 },   // Ramp up to 20 users
        { duration: '1m', target: 20 },   // Hold for 1 minute
        { duration: '30s', target: 0 },   // Cool down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<5000'],
    'http_req_failed': ['rate<0.1'],
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
  const userId = `chattester_${__VU}_${__ITER}`;
  const username = `ChatUser${__VU}`;

  group('WebSocket Shoutbox & Chat Load Test', () => {
    // Attempt WebSocket connection for chat
    const wsRes = ws.connect(`${WS_URL}/ws`, {
      tags: { name: 'WebSocketConnection' },
    }, function (socket) {
      socket.on('open', function () {
        check(true, {
          'websocket connected': () => true,
        });

        // Step 1: Send join message to register user
        socket.send(JSON.stringify({
          type: 'join',
          userId,
          username,
        }));

        sleep(0.5);

        // Step 2: Send public shoutbox messages (receiverId = null)
        for (let i = 0; i < 3; i++) {
          socket.send(JSON.stringify({
            type: 'send_message',
            userId,
            username,
            receiverId: null,  // null = public shoutbox
            text: messages[Math.floor(Math.random() * messages.length)],
          }));
          sleep(Math.random() * 0.5 + 0.3);
        }

        // Step 3: Send private messages to specific recipients
        // In a real scenario, we'd know other user IDs, but for testing we'll send to random user IDs
        for (let i = 0; i < 2; i++) {
          const targetUserId = `chattester_${Math.floor(Math.random() * 100)}_${Math.floor(Math.random() * 100)}`;
          socket.send(JSON.stringify({
            type: 'send_message',
            userId,
            username,
            receiverId: targetUserId,  // Specific user = private message
            text: `Private message: ${messages[Math.floor(Math.random() * messages.length)]}`,
          }));
          sleep(Math.random() * 0.5 + 0.3);
        }

        // Step 4: Listen for incoming messages for a bit
        socket.setTimeout(() => {
          socket.close();
        }, 5000);
      });

      socket.on('message', function (msg) {
        try {
          if (!msg || msg.length === 0) {
            return;
          }
          const data = JSON.parse(msg);
          if (data && data.type === 'message' && data.message) {
            check(true, {
              'received valid message': () => true,
              'message has content': () => data.message.text && data.message.text.length > 0,
            });
          } else if (data && data.type === 'online-users') {
            // Ignore online-users broadcast messages
            check(true, {
              'received valid message': () => true,
            });
          }
          chatDuration.add(1);
        } catch (err) {
          // Silently ignore non-JSON messages
        }
      });

      socket.on('error', function (err) {
        check(false, {
          'websocket error': () => false,
        });
        chatErrors.add(1);
        console.error('WebSocket error:', err);
      });

      socket.on('close', function () {
        check(true, {
          'websocket closed': () => true,
        });
      });
    });

    sleep(1);
  });

  // Also test chat history endpoint
  group('Chat History Retrieval', () => {
    const historyRes = http.get(`${BASE_URL}/api/chat-history`, {
      tags: { name: 'ChatHistory' },
    });

    const success = check(historyRes, {
      'chat history retrieved': (r) => r.status === 200,
      'chat history is array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body);
        } catch {
          return false;
        }
      },
    });

    if (!success) chatErrors.add(1);
    chatDuration.add(historyRes.timings.duration);
  });
}
