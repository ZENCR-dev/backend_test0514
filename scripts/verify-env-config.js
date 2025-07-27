const { config } = require('dotenv');
const path = require('path');

// 加载环境变量
config({ path: path.resolve(__dirname, '../.env') });

/**
 * ENV-03 环境配置验证脚本
 * 验证支付模块所需的所有环境变量配置
 */
function verifyEnvironmentConfiguration() {
  console.log('🔍 ENV-03: 环境配置验证开始...\n');

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    details: []
  };

  // 必需的环境变量配置
  const requiredConfigs = [
    {
      key: 'NODE_ENV',
      description: '运行环境',
      validator: (value) => ['development', 'test', 'staging', 'production'].includes(value),
      required: true
    },
    {
      key: 'DATABASE_URL',
      description: '数据库连接URL',
      validator: (value) => value && value.startsWith('postgresql://'),
      required: true
    },
    {
      key: 'SUPABASE_URL',
      description: 'Supabase项目URL',
      validator: (value) => value && value.startsWith('https://'),
      required: true
    },
    {
      key: 'SUPABASE_ANON_KEY',
      description: 'Supabase匿名密钥',
      validator: (value) => value && value.length > 100,
      required: true
    },
    {
      key: 'JWT_SECRET',
      description: 'JWT密钥',
      validator: (value) => value && value.length >= 32,
      required: true
    },
    {
      key: 'STRIPE_SECRET_KEY',
      description: 'Stripe密钥',
      validator: (value) => value && value.startsWith('sk_'),
      required: true
    },
    {
      key: 'STRIPE_PUBLISHABLE_KEY',
      description: 'Stripe公开密钥',
      validator: (value) => value && value.startsWith('pk_'),
      required: true
    },
    {
      key: 'STRIPE_WEBHOOK_SECRET',
      description: 'Stripe Webhook密钥',
      validator: (value) => value && value.startsWith('whsec_'),
      required: true
    }
  ];

  // 可选的环境变量配置
  const optionalConfigs = [
    {
      key: 'PORT',
      description: '服务端口',
      validator: (value) => !value || (!isNaN(value) && parseInt(value) > 0),
      default: '3000'
    },
    {
      key: 'JWT_EXPIRES_IN',
      description: 'JWT过期时间',
      validator: (value) => !value || /^\d+[dhms]$/.test(value),
      default: '7d'
    },
    {
      key: 'BCRYPT_SALT_ROUNDS',
      description: 'BCrypt盐轮数',
      validator: (value) => !value || (!isNaN(value) && parseInt(value) >= 10),
      default: '12'
    }
  ];

  console.log('📋 必需配置验证:');
  console.log('─'.repeat(60));

  // 验证必需配置
  requiredConfigs.forEach(config => {
    const value = process.env[config.key];
    const status = validateConfig(config, value, true);
    results.details.push(status);
    
    if (status.status === 'PASS') {
      results.passed++;
      console.log(`✅ ${config.key.padEnd(25)} | ${config.description}`);
    } else {
      results.failed++;
      console.log(`❌ ${config.key.padEnd(25)} | ${config.description} - ${status.message}`);
    }
  });

  console.log('\n📋 可选配置验证:');
  console.log('─'.repeat(60));

  // 验证可选配置
  optionalConfigs.forEach(config => {
    const value = process.env[config.key];
    const status = validateConfig(config, value, false);
    results.details.push(status);
    
    if (status.status === 'PASS') {
      results.passed++;
      console.log(`✅ ${config.key.padEnd(25)} | ${config.description} = ${value || config.default}`);
    } else if (status.status === 'WARN') {
      results.warnings++;
      console.log(`⚠️  ${config.key.padEnd(25)} | ${config.description} - ${status.message}`);
    } else {
      results.failed++;
      console.log(`❌ ${config.key.padEnd(25)} | ${config.description} - ${status.message}`);
    }
  });

  // Stripe环境验证
  console.log('\n🔐 Stripe配置验证:');
  console.log('─'.repeat(60));
  
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const nodeEnv = process.env.NODE_ENV;
  
  if (stripeSecretKey) {
    const isTestKey = stripeSecretKey.includes('_test_');
    const isLiveKey = stripeSecretKey.includes('_live_');
    
    if (nodeEnv === 'production' && isTestKey) {
      results.failed++;
      console.log('❌ 生产环境不能使用测试密钥');
    } else if (nodeEnv !== 'production' && isLiveKey) {
      results.warnings++;
      console.log('⚠️  非生产环境使用了生产密钥');
    } else {
      results.passed++;
      console.log(`✅ Stripe密钥环境匹配 (${isTestKey ? 'Test' : 'Live'} mode)`);
    }
  }

  // 输出总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 ENV-03 验证结果总结:');
  console.log('='.repeat(60));
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`⚠️  警告: ${results.warnings}`);
  
  const totalChecks = results.passed + results.failed + results.warnings;
  const successRate = ((results.passed / totalChecks) * 100).toFixed(1);
  
  console.log(`📈 成功率: ${successRate}%`);
  
  if (results.failed === 0) {
    console.log('\n🎉 ENV-03 环境配置验证通过！');
    console.log('✨ 支付模块环境配置完整，可以继续开发。');
    return true;
  } else {
    console.log('\n🚨 ENV-03 环境配置验证失败！');
    console.log('💡 请修复上述配置问题后重新验证。');
    return false;
  }
}

function validateConfig(config, value, isRequired) {
  if (!value) {
    if (isRequired) {
      return {
        status: 'FAIL',
        message: '缺少必需配置'
      };
    } else {
      return {
        status: 'WARN',
        message: `使用默认值: ${config.default || 'N/A'}`
      };
    }
  }

  if (config.validator && !config.validator(value)) {
    return {
      status: 'FAIL',
      message: '配置格式无效'
    };
  }

  return {
    status: 'PASS',
    message: '配置有效'
  };
}

// 运行验证
if (require.main === module) {
  const success = verifyEnvironmentConfiguration();
  process.exit(success ? 0 : 1);
}

module.exports = { verifyEnvironmentConfiguration }; 