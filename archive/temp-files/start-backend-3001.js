// 🚀 专用后端启动脚本 - 确保3001端口运行
// 解决端口冲突问题

const { execSync, spawn } = require('child_process');
const path = require('path');

console.log('🔧 后端服务启动中...');
console.log('目标端口: 3001');
console.log('时间:', new Date().toLocaleString());

// 强制设置端口环境变量
process.env.PORT = '3001';

try {
  // 先构建项目
  console.log('📦 构建TypeScript项目...');
  execSync('npx nest build', { stdio: 'inherit' });
  
  console.log('✅ 构建完成');
  console.log('🚀 启动NestJS应用服务器...');
  
  // 启动应用
  const child = spawn('node', ['dist/main.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: '3001',
      NODE_ENV: 'development'
    }
  });
  
  // 处理进程退出
  child.on('error', (error) => {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  });
  
  child.on('exit', (code) => {
    console.log(`\n🔄 后端服务进程退出，代码: ${code}`);
    if (code !== 0) {
      console.error('❌ 异常退出');
      process.exit(code);
    }
  });
  
  // 优雅关闭处理
  process.on('SIGINT', () => {
    console.log('\n🛑 接收到停止信号，正在关闭服务...');
    child.kill('SIGTERM');
    setTimeout(() => {
      child.kill('SIGKILL');
      process.exit(0);
    }, 5000);
  });
  
} catch (error) {
  console.error('❌ 启动过程中发生错误:', error.message);
  process.exit(1);
}

console.log('📍 后端API服务启动在: http://localhost:3001');
console.log('📚 API文档: http://localhost:3001/api/docs');
console.log('🔍 药品API: http://localhost:3001/api/v1/medicines'); 