#!/usr/bin/env npx tsx

import chalk from 'chalk';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

interface PerformanceConfig {
  enabled: boolean;
  thresholds: {
    api: {
      warning: number;    // ms
      critical: number;   // ms
    };
    database: {
      warning: number;    // ms 
      critical: number;   // ms
    };
    search: {
      warning: number;    // ms
      critical: number;   // ms
    };
  };
  monitoring: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    sampleRate: number; // 0-1, 1 means monitor 100% of requests
    enableMetrics: boolean;
    enableAlerts: boolean;
  };
  endpoints: string[];
  timestamp: string;
}

interface MonitoringSetupResult {
  success: boolean;
  configurationSteps: Array<{
    step: string;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    details: string;
    duration?: number;
  }>;
  summary: {
    configFilesCreated: number;
    endpointsConfigured: number;
    thresholdsSet: number;
    estimatedOverhead: string;
  };
}

class PerformanceMonitoringEnabler {
  private config: PerformanceConfig;
  private result: MonitoringSetupResult;
  private logsDir: string;
  private configDir: string;

  constructor() {
    this.logsDir = join(process.cwd(), 'logs', 'monitoring');
    this.configDir = join(process.cwd(), 'config', 'monitoring');
    
    this.config = {
      enabled: true,
      thresholds: {
        api: {
          warning: 300,    // DAY 2目标: <300ms
          critical: 1000   // 超过1秒认为有问题
        },
        database: {
          warning: 200,    // 数据库查询警告阈值
          critical: 500    // 数据库查询危险阈值
        },
        search: {
          warning: 300,    // 搜索功能警告阈值
          critical: 1000   // 搜索功能危险阈值
        }
      },
      monitoring: {
        logLevel: 'info',
        sampleRate: 1.0,  // 联调期间100%监控
        enableMetrics: true,
        enableAlerts: true
      },
      endpoints: [
        '/api/v1/medicines',
        '/api/v1/medicines/search', 
        '/api/v1/medicines/categories',
        '/api/v1/medicines/:id',
        '/api/v1/auth/login',
        '/api/v1/auth/me'
      ],
      timestamp: new Date().toISOString()
    };

    this.result = {
      success: true,
      configurationSteps: [],
      summary: {
        configFilesCreated: 0,
        endpointsConfigured: 0,
        thresholdsSet: 0,
        estimatedOverhead: '< 5ms per request'
      }
    };
  }

  private addStep(step: string, status: 'SUCCESS' | 'FAILED' | 'SKIPPED', details: string, duration?: number) {
    this.result.configurationSteps.push({ step, status, details, duration });
    if (status === 'FAILED') {
      this.result.success = false;
    }
  }

  private printHeader() {
    console.log(chalk.blue.bold('\n⚡ DAY 2 性能监控启用工具'));
    console.log(chalk.gray('='.repeat(60)));
    console.log(chalk.yellow(`配置时间: ${new Date().toLocaleString()}`));
    console.log(chalk.cyan('目标: 为药品模块联调提供实时性能监控'));
    console.log('');
  }

  private ensureDirectories() {
    const startTime = Date.now();
    
    try {
      // 创建日志目录
      if (!existsSync(this.logsDir)) {
        mkdirSync(this.logsDir, { recursive: true });
      }
      
      // 创建配置目录
      if (!existsSync(this.configDir)) {
        mkdirSync(this.configDir, { recursive: true });
      }

      // 创建结果目录
      const resultsDir = join(process.cwd(), 'scripts', 'results');
      if (!existsSync(resultsDir)) {
        mkdirSync(resultsDir, { recursive: true });
      }

      this.addStep(
        '创建监控目录结构',
        'SUCCESS',
        `目录创建完成: logs/monitoring, config/monitoring, scripts/results`,
        Date.now() - startTime
      );
    } catch (error: any) {
      this.addStep(
        '创建监控目录结构',
        'FAILED',
        `目录创建失败: ${error.message}`,
        Date.now() - startTime
      );
    }
  }

  private createPerformanceConfig() {
    const startTime = Date.now();
    
    try {
      const configPath = join(this.configDir, 'performance.json');
      writeFileSync(configPath, JSON.stringify(this.config, null, 2));
      
      this.result.summary.configFilesCreated++;
      this.addStep(
        '创建性能配置文件',
        'SUCCESS',
        `配置文件已保存: ${configPath}`,
        Date.now() - startTime
      );
    } catch (error: any) {
      this.addStep(
        '创建性能配置文件',
        'FAILED',
        `配置文件创建失败: ${error.message}`,
        Date.now() - startTime
      );
    }
  }

  private createMonitoringMiddleware() {
    const startTime = Date.now();
    
    try {
      const middlewarePath = join('src', 'common', 'middleware', 'performance-monitoring.middleware.ts');
      
      const middlewareCode = `import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { readFileSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';

interface PerformanceMetric {
  timestamp: string;
  method: string;
  url: string;
  duration: number;
  statusCode: number;
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class PerformanceMonitoringMiddleware implements NestMiddleware {
  private readonly logger = new Logger('PerformanceMonitoring');
  private config: any;
  private metricsBuffer: PerformanceMetric[] = [];
  private lastFlush = Date.now();

  constructor() {
    this.loadConfig();
    // 每10秒刷新一次指标到文件
    setInterval(() => this.flushMetrics(), 10000);
  }

  private loadConfig() {
    try {
      const configPath = join(process.cwd(), 'config', 'monitoring', 'performance.json');
      if (existsSync(configPath)) {
        this.config = JSON.parse(readFileSync(configPath, 'utf8'));
      } else {
        // 默认配置
        this.config = {
          enabled: true,
          thresholds: { api: { warning: 300, critical: 1000 } },
          monitoring: { logLevel: 'info', sampleRate: 1.0 }
        };
      }
    } catch (error) {
      this.logger.warn('Failed to load performance config, using defaults');
      this.config = { enabled: true, thresholds: { api: { warning: 300, critical: 1000 } } };
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    if (!this.config.enabled) {
      return next();
    }

    // 采样率控制
    if (Math.random() > this.config.monitoring.sampleRate) {
      return next();
    }

    const startTime = Date.now();
    const originalUrl = req.originalUrl;

    // 只监控API端点
    if (!originalUrl.startsWith('/api/')) {
      return next();
    }

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      this.recordMetric({
        timestamp: new Date().toISOString(),
        method: req.method,
        url: originalUrl,
        duration,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // 实时警告
      this.checkThresholds(originalUrl, duration);
    });

    next();
  }

  private recordMetric(metric: PerformanceMetric) {
    this.metricsBuffer.push(metric);
    
    // 如果缓冲区太大，立即刷新
    if (this.metricsBuffer.length > 100) {
      this.flushMetrics();
    }
  }

  private checkThresholds(url: string, duration: number) {
    const thresholds = this.config.thresholds.api;
    
    if (duration > thresholds.critical) {
      this.logger.error(\`⚠️ CRITICAL: \${url} took \${duration}ms (threshold: \${thresholds.critical}ms)\`);
    } else if (duration > thresholds.warning) {
      this.logger.warn(\`⚠️ WARNING: \${url} took \${duration}ms (threshold: \${thresholds.warning}ms)\`);
    } else if (this.config.monitoring.logLevel === 'debug') {
      this.logger.debug(\`✅ OK: \${url} took \${duration}ms\`);
    }
  }

  private flushMetrics() {
    if (this.metricsBuffer.length === 0) return;

    try {
      const logFile = join(process.cwd(), 'logs', 'monitoring', \`performance-\${new Date().toISOString().split('T')[0]}.jsonl\`);
      const logData = this.metricsBuffer.map(m => JSON.stringify(m)).join('\\n') + '\\n';
      
      appendFileSync(logFile, logData);
      
      this.logger.log(\`📊 Flushed \${this.metricsBuffer.length} performance metrics\`);
      this.metricsBuffer = [];
      this.lastFlush = Date.now();
    } catch (error) {
      this.logger.error('Failed to flush performance metrics:', error);
    }
  }
}`;

      // 确保目录存在
      const middlewareDir = join('src', 'common', 'middleware');
      if (!existsSync(middlewareDir)) {
        mkdirSync(middlewareDir, { recursive: true });
      }

      writeFileSync(middlewarePath, middlewareCode);
      
      this.result.summary.configFilesCreated++;
      this.addStep(
        '创建性能监控中间件',
        'SUCCESS',
        `中间件已创建: ${middlewarePath}`,
        Date.now() - startTime
      );
    } catch (error: any) {
      this.addStep(
        '创建性能监控中间件',
        'FAILED',
        `中间件创建失败: ${error.message}`,
        Date.now() - startTime
      );
    }
  }

  private createDashboardScript() {
    const startTime = Date.now();
    
    try {
      const dashboardPath = join('scripts', 'monitoring-dashboard.ts');
      
      const dashboardCode = `#!/usr/bin/env npx tsx

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

interface DashboardStats {
  totalRequests: number;
  averageResponseTime: number;
  slowestRequests: Array<{url: string, duration: number, timestamp: string}>;
  endpointStats: Record<string, {count: number, avgDuration: number, maxDuration: number}>;
  statusCodes: Record<number, number>;
}

class MonitoringDashboard {
  private logsDir = join(process.cwd(), 'logs', 'monitoring');

  private loadTodaysMetrics(): any[] {
    const today = new Date().toISOString().split('T')[0];
    const logFile = join(this.logsDir, \`performance-\${today}.jsonl\`);
    
    if (!existsSync(logFile)) {
      console.log(chalk.yellow('📊 今日暂无性能数据'));
      return [];
    }

    const content = readFileSync(logFile, 'utf8');
    return content.split('\\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  private generateStats(metrics: any[]): DashboardStats {
    const stats: DashboardStats = {
      totalRequests: metrics.length,
      averageResponseTime: 0,
      slowestRequests: [],
      endpointStats: {},
      statusCodes: {}
    };

    if (metrics.length === 0) return stats;

    // 计算平均响应时间
    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    stats.averageResponseTime = totalDuration / metrics.length;

    // 找出最慢的请求
    stats.slowestRequests = metrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .map(m => ({
        url: m.url,
        duration: m.duration,
        timestamp: m.timestamp
      }));

    // 按端点统计
    metrics.forEach(m => {
      const endpoint = m.url.split('?')[0]; // 去掉查询参数
      if (!stats.endpointStats[endpoint]) {
        stats.endpointStats[endpoint] = { count: 0, avgDuration: 0, maxDuration: 0 };
      }
      
      const endpointStat = stats.endpointStats[endpoint];
      endpointStat.count++;
      endpointStat.maxDuration = Math.max(endpointStat.maxDuration, m.duration);
    });

    // 计算每个端点的平均时间
    Object.keys(stats.endpointStats).forEach(endpoint => {
      const endpointMetrics = metrics.filter(m => m.url.split('?')[0] === endpoint);
      const avgDuration = endpointMetrics.reduce((sum, m) => sum + m.duration, 0) / endpointMetrics.length;
      stats.endpointStats[endpoint].avgDuration = avgDuration;
    });

    // 状态码统计
    metrics.forEach(m => {
      stats.statusCodes[m.statusCode] = (stats.statusCodes[m.statusCode] || 0) + 1;
    });

    return stats;
  }

  private printDashboard(stats: DashboardStats) {
    console.log(chalk.blue.bold('\\n⚡ DAY 2 联调性能监控面板'));
    console.log(chalk.gray('='.repeat(80)));
    console.log(chalk.yellow(\`📊 数据时间: \${new Date().toLocaleString()}\`));
    console.log('');

    // 总体统计
    console.log(chalk.blue.bold('📈 总体统计:'));
    console.log(\`📦 总请求数: \${chalk.cyan(stats.totalRequests)}\`);
    console.log(\`⏱️ 平均响应时间: \${chalk.cyan(stats.averageResponseTime.toFixed(1) + 'ms')}\`);
    console.log('');

    // 端点性能
    console.log(chalk.blue.bold('🎯 端点性能 (DAY 2重点监控):'));
    const sortedEndpoints = Object.entries(stats.endpointStats)
      .sort(([,a], [,b]) => b.count - a.count);
    
    sortedEndpoints.forEach(([endpoint, stat]) => {
      const avgColor = stat.avgDuration < 300 ? chalk.green : stat.avgDuration < 500 ? chalk.yellow : chalk.red;
      const maxColor = stat.maxDuration < 300 ? chalk.green : stat.maxDuration < 1000 ? chalk.yellow : chalk.red;
      
      console.log(\`📍 \${endpoint}\`);
      console.log(\`   请求数: \${chalk.cyan(stat.count)}, 平均: \${avgColor(stat.avgDuration.toFixed(1) + 'ms')}, 最大: \${maxColor(stat.maxDuration + 'ms')}\`);
    });
    console.log('');

    // 最慢请求
    if (stats.slowestRequests.length > 0) {
      console.log(chalk.blue.bold('🐌 最慢请求 TOP 5:'));
      stats.slowestRequests.slice(0, 5).forEach((req, i) => {
        const durationColor = req.duration < 500 ? chalk.yellow : chalk.red;
        console.log(\`\${i + 1}. \${req.url} - \${durationColor(req.duration + 'ms')} (\${req.timestamp})\`);
      });
      console.log('');
    }

    // 状态码分布
    console.log(chalk.blue.bold('📊 HTTP状态码分布:'));
    Object.entries(stats.statusCodes)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([code, count]) => {
        const codeColor = code.startsWith('2') ? chalk.green : 
                         code.startsWith('3') ? chalk.blue :
                         code.startsWith('4') ? chalk.yellow : chalk.red;
        console.log(\`\${codeColor(code)}: \${chalk.cyan(count)} 请求\`);
      });
    console.log('');

    // DAY 2 联调状态评估
    const overallHealth = this.assessHealth(stats);
    console.log(overallHealth);
  }

  private assessHealth(stats: DashboardStats): string {
    if (stats.totalRequests === 0) {
      return chalk.gray('📊 暂无数据，监控系统正常运行');
    }

    const criticalIssues: string[] = [];
    const warnings: string[] = [];

    // 检查平均响应时间
    if (stats.averageResponseTime > 500) {
      criticalIssues.push(\`平均响应时间过高: \${stats.averageResponseTime.toFixed(1)}ms\`);
    } else if (stats.averageResponseTime > 300) {
      warnings.push(\`平均响应时间偏高: \${stats.averageResponseTime.toFixed(1)}ms\`);
    }

    // 检查错误率
    const errorCount = Object.entries(stats.statusCodes)
      .filter(([code]) => parseInt(code) >= 400)
      .reduce((sum, [, count]) => sum + count, 0);
    
    const errorRate = (errorCount / stats.totalRequests) * 100;
    if (errorRate > 5) {
      criticalIssues.push(\`错误率过高: \${errorRate.toFixed(1)}%\`);
    } else if (errorRate > 1) {
      warnings.push(\`错误率偏高: \${errorRate.toFixed(1)}%\`);
    }

    if (criticalIssues.length > 0) {
      return chalk.red.bold(\`🚨 DAY 2联调状态: 需要关注\\n   \${criticalIssues.join('\\n   ')}\`);
    } else if (warnings.length > 0) {
      return chalk.yellow.bold(\`⚠️ DAY 2联调状态: 基本正常，有改进空间\\n   \${warnings.join('\\n   ')}\`);
    } else {
      return chalk.green.bold('🎉 DAY 2联调状态: 优秀！性能表现完全达标');
    }
  }

  run() {
    const metrics = this.loadTodaysMetrics();
    const stats = this.generateStats(metrics);
    this.printDashboard(stats);
  }
}

// 执行面板显示
if (require.main === module) {
  const dashboard = new MonitoringDashboard();
  dashboard.run();
}

export { MonitoringDashboard };`;

      writeFileSync(dashboardPath, dashboardCode);
      
      this.result.summary.configFilesCreated++;
      this.addStep(
        '创建监控面板脚本',
        'SUCCESS',
        `监控面板已创建: ${dashboardPath}`,
        Date.now() - startTime
      );
    } catch (error: any) {
      this.addStep(
        '创建监控面板脚本',
        'FAILED',
        `监控面板创建失败: ${error.message}`,
        Date.now() - startTime
      );
    }
  }

  private updatePackageJson() {
    const startTime = Date.now();
    
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      
      // 添加监控相关的脚本命令
      if (!packageJson.scripts['monitoring:dashboard']) {
        packageJson.scripts['monitoring:dashboard'] = 'npx tsx scripts/monitoring-dashboard.ts';
      }
      
      if (!packageJson.scripts['monitoring:status']) {
        packageJson.scripts['monitoring:status'] = 'npx tsx scripts/monitoring-dashboard.ts';
      }

      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      
      this.addStep(
        '更新package.json脚本',
        'SUCCESS',
        '添加了监控相关的npm脚本命令',
        Date.now() - startTime
      );
    } catch (error: any) {
      this.addStep(
        '更新package.json脚本',
        'FAILED',
        `package.json更新失败: ${error.message}`,
        Date.now() - startTime
      );
    }
  }

  private printResults() {
    console.log(chalk.blue.bold('\n📊 性能监控配置结果:'));
    
    this.result.configurationSteps.forEach(step => {
      const icon = step.status === 'SUCCESS' ? '✅' : step.status === 'SKIPPED' ? '⚠️' : '❌';
      const color = step.status === 'SUCCESS' ? chalk.green : step.status === 'SKIPPED' ? chalk.yellow : chalk.red;
      
      console.log(`${icon} ${color(step.step)}`);
      console.log(`   ${step.details}`);
      if (step.duration) {
        console.log(`   耗时: ${chalk.cyan(step.duration + 'ms')}`);
      }
      console.log('');
    });

    console.log(chalk.blue.bold('📈 配置摘要:'));
    console.log(`📄 配置文件: ${chalk.cyan(this.result.summary.configFilesCreated)}`);
    console.log(`🎯 监控端点: ${chalk.cyan(this.config.endpoints.length)}`);
    console.log(`⚡ 性能阈值: ${chalk.cyan('API<300ms, 搜索<300ms, 数据库<200ms')}`);
    console.log(`📊 监控开销: ${chalk.cyan(this.result.summary.estimatedOverhead)}`);

    console.log(chalk.blue.bold('\n🚀 使用方法:'));
    console.log(chalk.cyan('1. 重启后端服务以启用监控中间件'));
    console.log(chalk.cyan('2. 运行 npm run monitoring:dashboard 查看实时性能'));
    console.log(chalk.cyan('3. 监控日志保存在 logs/monitoring/ 目录'));
    console.log(chalk.cyan('4. DAY 2联调时实时观察性能指标'));

    const overallStatus = this.result.success ? 
      chalk.green.bold('\n🎉 性能监控启用完成 - DAY 2联调实时监控就绪!') : 
      chalk.red.bold('\n⚠️ 监控配置部分失败，请检查错误信息');
    
    console.log(overallStatus);
  }

  async run() {
    this.printHeader();

    try {
      this.ensureDirectories();
      this.createPerformanceConfig();
      this.createMonitoringMiddleware();
      this.createDashboardScript();
      this.updatePackageJson();

      this.result.summary.endpointsConfigured = this.config.endpoints.length;
      this.result.summary.thresholdsSet = Object.keys(this.config.thresholds).length;

      this.printResults();

      // 保存结果到文件
      const resultPath = join('scripts', 'results', 'monitoring-setup-report.json');
      writeFileSync(resultPath, JSON.stringify({
        config: this.config,
        setupResult: this.result,
        instructions: {
          nextSteps: [
            '1. 重启后端服务 (npm run start:dev)',
            '2. 在app.module.ts中注册PerformanceMonitoringMiddleware',
            '3. 运行 npm run monitoring:dashboard 查看性能数据',
            '4. DAY 2联调时持续监控性能指标'
          ],
          quickCommands: [
            'npm run monitoring:dashboard - 查看性能面板',
            'npm run monitoring:status - 查看系统状态'
          ]
        }
      }, null, 2));

      console.log(chalk.gray(`\n📄 详细配置报告已保存至: ${resultPath}`));

    } catch (error) {
      console.error(chalk.red('❌ 监控配置过程中发生错误:'), error);
      this.result.success = false;
    }

    process.exit(this.result.success ? 0 : 1);
  }
}

// 执行监控启用
if (require.main === module) {
  const enabler = new PerformanceMonitoringEnabler();
  enabler.run().catch(console.error);
}

export { PerformanceMonitoringEnabler }; 