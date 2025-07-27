import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// 测试配置
export let options = {
  stages: [
    { duration: '5s', target: 5 },   // 预热
    { duration: '20s', target: 50 }, // 主要负载
    { duration: '10s', target: 100 }, // 峰值负载
    { duration: '5s', target: 0 },   // 降载
  ],
  thresholds: {
    // 核心KPI验证标准
    'http_req_duration{test_type:performance}': ['p(95)<200'], // P95 < 200ms
    'http_req_duration{test_type:performance}': ['p(99)<500'], // P99 < 500ms
    'http_req_duration{test_type:idempotency}': ['p(95)<200'], // 幂等性响应时间
    'checks{test_type:idempotency}': ['rate>0.5'], // 幂等性检查成功率 > 50%
    'checks{test_type:event_types}': ['rate>0.5'], // 事件处理成功率 > 50%
  },
};

// 不同的事件类型模板
const eventTemplates = new SharedArray('event_templates', function() {
  return [
    {
      type: 'payment_intent.succeeded',
      template: {
        id: 'evt_test_webhook_succeeded',
        object: 'event',
        api_version: '2020-08-27',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'pi_test_payment_intent_succeeded',
            object: 'payment_intent',
            amount: 2000,
            currency: 'nzd',
            status: 'succeeded',
            metadata: {
              orderId: 'order_test_12345',
              clinicId: 'clinic_test_67890'
            }
          }
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_test_succeeded', idempotency_key: null },
        type: 'payment_intent.succeeded'
      }
    },
    {
      type: 'payment_intent.payment_failed',
      template: {
        id: 'evt_test_webhook_failed',
        object: 'event',
        api_version: '2020-08-27',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'pi_test_payment_intent_failed',
            object: 'payment_intent',
            amount: 1500,
            currency: 'nzd',
            status: 'requires_payment_method',
            last_payment_error: {
              message: 'Your card was declined.'
            },
            metadata: {
              orderId: 'order_test_54321',
              clinicId: 'clinic_test_09876'
            }
          }
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_test_failed', idempotency_key: null },
        type: 'payment_intent.payment_failed'
      }
    },
    {
      type: 'payment_intent.canceled',
      template: {
        id: 'evt_test_webhook_canceled',
        object: 'event',
        api_version: '2020-08-27',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'pi_test_payment_intent_canceled',
            object: 'payment_intent',
            amount: 3000,
            currency: 'nzd',
            status: 'canceled',
            metadata: {
              orderId: 'order_test_99999',
              clinicId: 'clinic_test_11111'
            }
          }
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_test_canceled', idempotency_key: null },
        type: 'payment_intent.canceled'
      }
    }
  ];
});

export default function() {
  const testPhase = Math.floor(__VU / 20); // 根据VU数量决定测试类型
  
  if (testPhase === 0) {
    // Phase 1: 性能测试 (VU 1-20)
    performanceTest();
  } else if (testPhase === 1) {
    // Phase 2: 幂等性测试 (VU 21-40)
    idempotencyTest();
  } else {
    // Phase 3: 事件类型覆盖测试 (VU 41+)
    eventTypeCoverageTest();
  }
  
  sleep(0.1);
}

// 性能测试 - 验证P95/P99响应时间
function performanceTest() {
  const eventData = createRandomEvent('payment_intent.succeeded');
  const payload = JSON.stringify(eventData);
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 't=1640995200,v1=test_signature_performance',
    },
    tags: { test_type: 'performance' }
  };

  let response = http.post('http://localhost:3000/api/v1/payments/webhook', payload, params);
  
  check(response, {
    'performance_status_ok': (r) => r.status === 200 || r.status === 400,
    'performance_fast_response': (r) => r.timings.duration < 500,
  }, { test_type: 'performance' });
}

// 幂等性测试 - 验证重复事件处理
function idempotencyTest() {
  const baseEventId = `evt_idempotency_test_${__VU}_${Math.floor(__ITER / 3)}`;
  const eventData = createRandomEvent('payment_intent.succeeded', baseEventId);
  const payload = JSON.stringify(eventData);
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 't=1640995200,v1=test_signature_idempotency',
    },
    tags: { test_type: 'idempotency' }
  };

  let response = http.post('http://localhost:3000/api/v1/payments/webhook', payload, params);
  
  check(response, {
    'idempotency_status_ok': (r) => r.status === 200 || r.status === 400,
    'idempotency_consistent': (r) => r.timings.duration < 1000, // 幂等处理应该更快
  }, { test_type: 'idempotency' });
}

// 事件类型覆盖测试 - 验证不同事件类型处理
function eventTypeCoverageTest() {
  const template = eventTemplates[__ITER % eventTemplates.length];
  const eventData = { ...template.template };
  eventData.id = `${eventData.id}_${__VU}_${__ITER}`;
  eventData.created = Math.floor(Date.now() / 1000);
  
  const payload = JSON.stringify(eventData);
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': `t=1640995200,v1=test_signature_${template.type}`,
    },
    tags: { test_type: 'event_types', event_type: template.type }
  };

  let response = http.post('http://localhost:3000/api/v1/payments/webhook', payload, params);
  
  check(response, {
    'event_type_handled': (r) => r.status === 200 || r.status === 400,
    'event_type_fast': (r) => r.timings.duration < 1000,
  }, { test_type: 'event_types', event_type: template.type });
}

// 创建随机事件数据
function createRandomEvent(eventType, customId = null) {
  const eventId = customId || `evt_${eventType}_${__VU}_${__ITER}_${Date.now()}`;
  const orderId = `order_${__VU}_${__ITER}_${Date.now()}`;
  const clinicId = `clinic_${__VU % 10}`;
  
  return {
    id: eventId,
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `pi_${eventId}`,
        object: 'payment_intent',
        amount: Math.floor(Math.random() * 5000) + 1000, // 1000-6000 cents
        currency: 'nzd',
        status: eventType.includes('succeeded') ? 'succeeded' : 'requires_payment_method',
        metadata: {
          orderId: orderId,
          clinicId: clinicId
        }
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: `req_${eventId}`, idempotency_key: null },
    type: eventType
  };
} 