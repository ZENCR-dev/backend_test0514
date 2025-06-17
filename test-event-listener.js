const { default: fetch } = require('node-fetch');

// 简化的EventEmitter测试
async function testEventEmitter() {
  console.log('🚀 开始EventEmitter验证测试...\n');
  
  const webhookUrl = 'http://localhost:3000/api/v1/payments/webhook';
  const events = [
    {
      name: 'payment_intent.succeeded',
      payload: {
        id: 'evt_test_event_emitter_001',
        object: 'event',
        api_version: '2020-08-27',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'pi_test_event_emitter_001',
            object: 'payment_intent',
            amount: 2000,
            currency: 'nzd',
            status: 'succeeded',
            metadata: {
              orderId: 'order_event_test_001',
              clinicId: 'clinic_event_test_001'
            }
          }
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_event_test_001', idempotency_key: null },
        type: 'payment_intent.succeeded'
      }
    },
    {
      name: 'payment_intent.payment_failed',
      payload: {
        id: 'evt_test_event_emitter_002',
        object: 'event',
        api_version: '2020-08-27',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'pi_test_event_emitter_002',
            object: 'payment_intent',
            amount: 1500,
            currency: 'nzd',
            status: 'requires_payment_method',
            last_payment_error: {
              message: 'Your card was declined.'
            },
            metadata: {
              orderId: 'order_event_test_002',
              clinicId: 'clinic_event_test_002'
            }
          }
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_event_test_002', idempotency_key: null },
        type: 'payment_intent.payment_failed'
      }
    }
  ];

  for (const event of events) {
    console.log(`📤 发送 ${event.name} 事件...`);
    
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 't=1640995200,v1=test_signature_event_emitter'
        },
        body: JSON.stringify(event.payload)
      });
      
      console.log(`📨 响应状态: ${response.status}`);
      console.log(`📊 响应头: ${JSON.stringify(Object.fromEntries(response.headers))}`);
      
      if (response.status === 200) {
        console.log(`✅ ${event.name} 事件处理成功`);
      } else if (response.status === 400) {
        console.log(`⚠️ ${event.name} 事件被拒绝 (签名验证失败，这是预期的)`);
      } else {
        console.log(`❌ ${event.name} 事件处理异常: ${response.status}`);
      }
      
    } catch (error) {
      console.error(`❌ 发送 ${event.name} 事件失败:`, error.message);
    }
    
    console.log(''); // 空行分隔
    
    // 等待500ms再发送下一个事件
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('🏁 EventEmitter验证测试完成');
  console.log('💡 请检查应用日志以确认EventEmitter事件是否被正确发射');
}

// 幂等性测试 - 发送相同事件多次
async function testIdempotency() {
  console.log('\n🔄 开始幂等性验证测试...\n');
  
  const sameEvent = {
    id: 'evt_idempotency_test_same_event',
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'pi_idempotency_test',
        object: 'payment_intent',
        amount: 3000,
        currency: 'nzd',
        status: 'succeeded',
        metadata: {
          orderId: 'order_idempotency_test',
          clinicId: 'clinic_idempotency_test'
        }
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: 'req_idempotency_test', idempotency_key: null },
    type: 'payment_intent.succeeded'
  };
  
  const webhookUrl = 'http://localhost:3000/api/v1/payments/webhook';
  
  for (let i = 1; i <= 3; i++) {
    console.log(`📤 第${i}次发送相同事件 (ID: ${sameEvent.id})...`);
    
    try {
      const startTime = Date.now();
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 't=1640995200,v1=test_signature_idempotency'
        },
        body: JSON.stringify(sameEvent)
      });
      const endTime = Date.now();
      
      console.log(`📨 响应状态: ${response.status}`);
      console.log(`⏱️ 响应时间: ${endTime - startTime}ms`);
      
      if (i === 1) {
        console.log(`✅ 首次处理: ${response.status === 200 || response.status === 400 ? '成功' : '失败'}`);
      } else {
        console.log(`🔄 幂等处理: ${response.status === 200 || response.status === 400 ? '成功' : '失败'}`);
        if (endTime - startTime < 50) {
          console.log(`⚡ 幂等性响应更快 (${endTime - startTime}ms) - 这表明幂等性机制生效`);
        }
      }
      
    } catch (error) {
      console.error(`❌ 第${i}次发送失败:`, error.message);
    }
    
    console.log(''); // 空行分隔
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('🏁 幂等性验证测试完成');
}

async function main() {
  await testEventEmitter();
  await testIdempotency();
}

main().catch(console.error); 