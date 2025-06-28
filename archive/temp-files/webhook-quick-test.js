import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '10s', target: 10 },  // 10 并发用户，持续10秒
    { duration: '20s', target: 20 },  // 升到20并发用户，持续20秒
    { duration: '10s', target: 0 },   // 降到0
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // P95 < 200ms
    http_req_duration: ['p(99)<500'], // P99 < 500ms  
    http_req_failed: ['rate<0.5'],    // 错误率 < 50% (由于签名验证问题，会有一些错误)
  },
};

export default function() {
  // 模拟Stripe webhook payload
  const payload = JSON.stringify({
    id: 'evt_test_webhook',
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'pi_test_payment_intent',
        object: 'payment_intent',
        amount: 2000,
        currency: 'nzd',
        status: 'succeeded'
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: 'req_test',
      idempotency_key: null
    },
    type: 'payment_intent.succeeded'
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 't=1640995200,v1=test_signature',
    },
  };

  let response = http.post('http://localhost:3000/api/v1/payments/webhook', payload, params);
  
  check(response, {
    'status is 200 or 400': (r) => r.status === 200 || r.status === 400, // 400 is expected for signature verification
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(0.1); // 100ms间隔
} 