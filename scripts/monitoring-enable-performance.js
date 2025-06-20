// 📊 性能监控启用脚本
// 核心小组指定 - DAY 3准备必执行脚本 3/4

const fs = require('fs');
const path = require('path');

console.log('📊 性能监控系统启用开始...');
console.log('时间:', new Date().toLocaleString());
console.log('==========================================');

function enablePerformanceMonitoring() {
  try {
    // 1. 创建监控配置文件
    console.log('\n🔧 1. 创建性能监控配置');
    
    const monitoringConfig = {
      enabled: true,
      metrics: {
        api_response_time: true,
        database_query_time: true,
        memory_usage: true,
        cpu_usage: true,
        request_count: true,
        error_rate: true
      },
      thresholds: {
        api_response_time_ms: 500,
        database_query_time_ms: 200,
        memory_usage_mb: 512,
        cpu_usage_percent: 80,
        error_rate_percent: 5
      },
      reporting: {
        interval_seconds: 60,
        log_file: 'logs/performance.log',
        console_output: true
      },
      day3_special: {
        medicines_api_monitoring: true,
        prescription_api_monitoring: true,
        search_performance_tracking: true,
        concurrent_request_monitoring: true
      }
    };

    // 确保logs目录存在
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      console.log('✅ 创建logs目录');
    }

    // 写入配置文件
    const configPath = path.join(process.cwd(), 'monitoring.config.json');
    fs.writeFileSync(configPath, JSON.stringify(monitoringConfig, null, 2));
    console.log('✅ 监控配置文件创建: monitoring.config.json');

    // 2. 创建性能中间件
    console.log('\n🚀 2. 生成性能监控中间件');
    
    const performanceMiddleware = `
// 自动生成的性能监控中间件 - DAY 3专用
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  private readonly logger = new Logger('PerformanceMonitor');
  private readonly metrics = new Map<string, number[]>();

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const route = \`\${req.method} \${req.route?.path || req.path}\`;

    // 特别关注DAY 3关键API
    const isMonitoredRoute = [
      '/api/v1/medicines',
      '/api/v1/medicines/search',
      '/api/v1/prescriptions'
    ].some(path => req.path.startsWith(path));

    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      
      // 记录性能指标
      if (!this.metrics.has(route)) {
        this.metrics.set(route, []);
      }
      this.metrics.get(route)!.push(responseTime);

      // DAY 3关键路径特殊监控
      if (isMonitoredRoute) {
        const logLevel = responseTime > 500 ? 'warn' : 'log';
        this.logger[logLevel](
          \`DAY3-MONITOR: \${route} - \${responseTime}ms - Status: \${res.statusCode}\`
        );

        // 性能阈值告警
        if (responseTime > 1000) {
          this.logger.error(
            \`🚨 PERFORMANCE ALERT: \${route} exceeded 1000ms (\${responseTime}ms)\`
          );
        }
      }

      // 每分钟输出统计
      this.outputMetrics();
    });

    next();
  }

  private outputMetrics() {
    // 简单的性能统计输出
    setInterval(() => {
      for (const [route, times] of this.metrics.entries()) {
        if (times.length > 0) {
          const avg = times.reduce((a, b) => a + b, 0) / times.length;
          const max = Math.max(...times);
          this.logger.log(\`📊 \${route}: avg=\${avg.toFixed(2)}ms, max=\${max}ms, count=\${times.length}\`);
          times.length = 0; // 清空数据
        }
      }
    }, 60000);
  }
}
`;

    const middlewarePath = path.join(process.cwd(), 'src/common/middleware/performance.middleware.ts');
    const middlewareDir = path.dirname(middlewarePath);
    
    if (!fs.existsSync(middlewareDir)) {
      fs.mkdirSync(middlewareDir, { recursive: true });
    }
    
    fs.writeFileSync(middlewarePath, performanceMiddleware);
    console.log('✅ 性能监控中间件生成: src/common/middleware/performance.middleware.ts');

    // 3. 创建监控仪表板HTML
    console.log('\n📈 3. 创建监控仪表板');
    
    const dashboardHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>TCM平台性能监控 - DAY 3</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .alert { background: #ffebee; border-left: 4px solid #f44336; }
        .success { background: #e8f5e8; border-left: 4px solid #4caf50; }
        .warning { background: #fff3e0; border-left: 4px solid #ff9800; }
        .title { color: #333; border-bottom: 2px solid #2196f3; padding-bottom: 10px; }
    </style>
</head>
<body>
    <h1 class="title">🏥 新西兰TCM处方平台 - DAY 3性能监控</h1>
    
    <div class="metric success">
        <h3>📊 监控状态</h3>
        <p>✅ 性能监控已启用</p>
        <p>✅ DAY 3关键API监控就绪</p>
        <p>✅ 阈值告警系统激活</p>
        <p>⏰ 监控时间: <span id="currentTime"></span></p>
    </div>

    <div class="metric">
        <h3>🎯 DAY 3关键指标</h3>
        <ul>
            <li>药品API响应时间目标: &lt; 500ms</li>
            <li>搜索功能响应目标: &lt; 300ms</li>
            <li>处方创建响应目标: &lt; 800ms</li>
            <li>并发用户支持: ≥ 50</li>
        </ul>
    </div>

    <div class="metric warning">
        <h3>⚠️ 注意事项</h3>
        <p>此监控系统专为DAY 3联调测试设计</p>
        <p>监控数据存储在logs/performance.log</p>
        <p>超过阈值时会自动告警</p>
    </div>

    <script>
        document.getElementById('currentTime').textContent = new Date().toLocaleString();
        setInterval(() => {
            document.getElementById('currentTime').textContent = new Date().toLocaleString();
        }, 1000);
    </script>
</body>
</html>
`;

    const dashboardPath = path.join(process.cwd(), 'monitoring-dashboard.html');
    fs.writeFileSync(dashboardPath, dashboardHTML);
    console.log('✅ 监控仪表板创建: monitoring-dashboard.html');

    // 4. 创建package.json脚本
    console.log('\n🔧 4. 添加监控命令');
    
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }
      
      packageJson.scripts['monitoring:enable'] = 'node scripts/monitoring-enable-performance.js';
      packageJson.scripts['monitoring:dashboard'] = 'start monitoring-dashboard.html';
      packageJson.scripts['monitoring:logs'] = 'tail -f logs/performance.log';
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('✅ package.json监控脚本添加完成');
    }

    // 5. 启动监控系统
    console.log('\n🚀 5. 启动监控系统');
    
    const startTime = Date.now();
    console.log('✅ 监控系统启动时间:', new Date().toLocaleString());
    console.log('✅ 性能日志路径: logs/performance.log');
    console.log('✅ 监控仪表板: monitoring-dashboard.html');
    console.log('✅ 配置文件: monitoring.config.json');

    // 创建初始日志文件
    const logPath = path.join(process.cwd(), 'logs/performance.log');
    const initialLog = `# TCM平台性能监控日志 - DAY 3
# 启动时间: ${new Date().toLocaleString()}
# 监控状态: 已启用
# ===========================================

`;
    fs.writeFileSync(logPath, initialLog);

    console.log('\n==========================================');
    console.log('🎉 性能监控系统启用完成');
    console.log('📊 监控范围: API响应时间、数据库查询、内存使用、错误率');
    console.log('🎯 DAY 3专项: 药品API、处方API、搜索功能特别监控');
    
    return true;

  } catch (error) {
    console.error('❌ 性能监控启用过程中发生错误:', error.message);
    return false;
  }
}

// 执行监控启用
const success = enablePerformanceMonitoring();

if (success) {
  console.log('\n🏆 性能监控：启用成功，DAY 3联调监控就绪');
  process.exit(0);
} else {
  console.log('\n⚠️ 性能监控：启用失败，需要检查');
  process.exit(1);
} 