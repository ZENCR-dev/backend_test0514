// 🧹 端口清理脚本
// 终止占用3000和3001端口的进程

const { execSync } = require('child_process');

console.log('🧹 开始清理端口...');
console.log('时间:', new Date().toLocaleString());

function killProcessOnPort(port) {
  try {
    console.log(`\n🔍 检查端口 ${port}...`);
    
    // Windows命令查找占用端口的进程
    const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    
    if (result.trim()) {
      console.log(`📍 发现端口 ${port} 被占用:`);
      console.log(result);
      
      // 提取PID（最后一列）
      const lines = result.trim().split('\n');
      const pids = new Set();
      
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 4) {
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid)) {
            pids.add(pid);
          }
        }
      });
      
      // 终止进程
      pids.forEach(pid => {
        try {
          console.log(`💀 终止进程 PID: ${pid}`);
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
          console.log(`✅ 成功终止进程 ${pid}`);
        } catch (error) {
          console.log(`⚠️  无法终止进程 ${pid}:`, error.message);
        }
      });
      
    } else {
      console.log(`✅ 端口 ${port} 未被占用`);
    }
    
  } catch (error) {
    console.log(`✅ 端口 ${port} 未被占用或无法检查`);
  }
}

// 清理两个端口
killProcessOnPort(3000);
killProcessOnPort(3001);

console.log('\n🎯 端口清理完成！');
console.log('等待2秒钟让系统释放端口...');

setTimeout(() => {
  console.log('✅ 端口清理和等待完成');
  console.log('📍 现在可以启动后端服务在 3001 端口');
}, 2000); 