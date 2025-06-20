// 🚀 DAY 3准备脚本执行器
// 核心小组指定 - 今日19:00前必须完成

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 DAY 3联调准备脚本执行开始...');
console.log('时间:', new Date().toLocaleString());
console.log('==========================================');

const scripts = [
  {
    name: '数据库状态检查',
    file: 'scripts/db-check-medicines-data.js',
    description: '检查药品数据库状态和数据完整性'
  },
  {
    name: '搜索索引优化',
    file: 'scripts/search-rebuild-index.js',
    description: '重建搜索索引，优化搜索性能'
  },
  {
    name: '性能监控启用',
    file: 'scripts/monitoring-enable-performance.js',
    description: '启用DAY 3专用性能监控系统'
  },
  {
    name: '测试数据准备',
    file: 'scripts/seed-medicines-test-data.js',
    description: '准备DAY 3联调测试专用数据'
  }
];

async function runScript(script) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔧 执行: ${script.name}`);
    console.log(`📝 描述: ${script.description}`);
    console.log(`📂 文件: ${script.file}`);
    console.log('-------------------------------------------');

    const startTime = Date.now();
    const child = spawn('node', [script.file], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      
      if (code === 0) {
        console.log(`✅ ${script.name} 完成 (${duration}ms)`);
        resolve({ success: true, duration, script: script.name });
      } else {
        console.log(`❌ ${script.name} 失败 (退出码: ${code})`);
        resolve({ success: false, duration, script: script.name, code });
      }
    });

    child.on('error', (error) => {
      const duration = Date.now() - startTime;
      console.log(`❌ ${script.name} 执行错误: ${error.message}`);
      resolve({ success: false, duration, script: script.name, error: error.message });
    });
  });
}

async function runAllScripts() {
  console.log(`📋 准备执行 ${scripts.length} 个DAY 3准备脚本\n`);
  
  const results = [];
  const totalStartTime = Date.now();

  for (const script of scripts) {
    const result = await runScript(script);
    results.push(result);
    
    // 脚本间稍作间隔
    if (script !== scripts[scripts.length - 1]) {
      console.log('⏳ 等待2秒后执行下一个脚本...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const totalDuration = Date.now() - totalStartTime;

  // 输出执行总结
  console.log('\n==========================================');
  console.log('🎯 DAY 3准备脚本执行总结');
  console.log('==========================================');

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  console.log(`📊 总体状态: ${successCount}/${results.length} 成功`);
  console.log(`⏱️ 总执行时间: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}秒)`);

  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const duration = `${result.duration}ms`;
    console.log(`${status} ${index + 1}. ${result.script} - ${duration}`);
    
    if (!result.success && result.code) {
      console.log(`    退出码: ${result.code}`);
    }
    if (!result.success && result.error) {
      console.log(`    错误: ${result.error}`);
    }
  });

  console.log('\n🎯 DAY 3准备状态评估:');
  
  if (successCount === results.length) {
    console.log('🏆 完美完成！所有DAY 3准备脚本执行成功');
    console.log('✅ 数据库状态: 已检查');
    console.log('✅ 搜索索引: 已优化');
    console.log('✅ 性能监控: 已启用');
    console.log('✅ 测试数据: 已准备');
    console.log('\n🚀 后端团队DAY 3联调准备完成！');
    console.log('📅 明日09:00可开始DAY 3联调测试');
    
    return true;
  } else {
    console.log(`⚠️ 部分失败: ${failureCount} 个脚本需要修复`);
    console.log('🔧 建议: 检查失败的脚本并重新执行');
    
    return false;
  }
}

// 执行所有脚本
runAllScripts()
  .then(success => {
    if (success) {
      console.log('\n🎉 DAY 3准备: 100%完成，后端团队就绪！');
      process.exit(0);
    } else {
      console.log('\n⚠️ DAY 3准备: 需要修复，请检查失败项目');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ 执行器发生致命错误:', error);
    process.exit(1);
  }); 