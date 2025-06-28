const { default: fetch } = require('node-fetch');

async function simpleWebhookTest() {
  console.log('🔍 诊断webhook 500错误...\n');
  
  const webhookUrl = 'http://localhost:3000/api/v1/payments/webhook';
  
  // 最简单的payload
  const simplePayload = {
    id: 'evt_simple_test',
    object: 'event',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_simple_test',
        object: 'payment_intent',
        status: 'succeeded'
      }
    }
  };

  try {
    console.log('📤 发送简单的webhook请求...');
    console.log('📄 Payload:', JSON.stringify(simplePayload, null, 2));
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 't=1640995200,v1=simple_test_signature'
      },
      body: JSON.stringify(simplePayload)
    });
    
    console.log(`📨 响应状态: ${response.status}`);
    
    const responseText = await response.text();
    console.log(`📄 响应内容: ${responseText}`);
    
    if (response.status === 500) {
      console.log('❌ 服务器内部错误，可能的原因:');
      console.log('  1. Stripe配置问题 (webhook secret)');
      console.log('  2. PaymentService依赖注入问题');
      console.log('  3. 数据库连接问题');
      console.log('  4. EventEmitter配置问题');
    }
    
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
  }
}

simpleWebhookTest(); 