#!/usr/bin/env npx tsx

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
    const logFile = join(this.logsDir, `performance-${today}.jsonl`);
    
    if (!existsSync(logFile)) {
      console.log(chalk.yellow('📊 今日暂无性能数据'));
      return [];
    }

    const content = readFileSync(logFile, 'utf8');
    return content.split('\n')
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
    console.log(chalk.blue.bold('\n⚡ DAY 2 联调性能监控面板'));
    console.log(chalk.gray('='.repeat(80)));
    console.log(chalk.yellow(`📊 数据时间: ${new Date().toLocaleString()}`));
    console.log('');

    // 总体统计
    console.log(chalk.blue.bold('📈 总体统计:'));
    console.log(`📦 总请求数: ${chalk.cyan(stats.totalRequests)}`);
    console.log(`⏱️ 平均响应时间: ${chalk.cyan(stats.averageResponseTime.toFixed(1) + 'ms')}`);
    console.log('');

    // 端点性能
    console.log(chalk.blue.bold('🎯 端点性能 (DAY 2重点监控):'));
    const sortedEndpoints = Object.entries(stats.endpointStats)
      .sort(([,a], [,b]) => b.count - a.count);
    
    sortedEndpoints.forEach(([endpoint, stat]) => {
      const avgColor = stat.avgDuration < 300 ? chalk.green : stat.avgDuration < 500 ? chalk.yellow : chalk.red;
      const maxColor = stat.maxDuration < 300 ? chalk.green : stat.maxDuration < 1000 ? chalk.yellow : chalk.red;
      
      console.log(`📍 ${endpoint}`);
      console.log(`   请求数: ${chalk.cyan(stat.count)}, 平均: ${avgColor(stat.avgDuration.toFixed(1) + 'ms')}, 最大: ${maxColor(stat.maxDuration + 'ms')}`);
    });
    console.log('');

    // 最慢请求
    if (stats.slowestRequests.length > 0) {
      console.log(chalk.blue.bold('🐌 最慢请求 TOP 5:'));
      stats.slowestRequests.slice(0, 5).forEach((req, i) => {
        const durationColor = req.duration < 500 ? chalk.yellow : chalk.red;
        console.log(`${i + 1}. ${req.url} - ${durationColor(req.duration + 'ms')} (${req.timestamp})`);
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
        console.log(`${codeColor(code)}: ${chalk.cyan(count)} 请求`);
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
      criticalIssues.push(`平均响应时间过高: ${stats.averageResponseTime.toFixed(1)}ms`);
    } else if (stats.averageResponseTime > 300) {
      warnings.push(`平均响应时间偏高: ${stats.averageResponseTime.toFixed(1)}ms`);
    }

    // 检查错误率
    const errorCount = Object.entries(stats.statusCodes)
      .filter(([code]) => parseInt(code) >= 400)
      .reduce((sum, [, count]) => sum + count, 0);
    
    const errorRate = (errorCount / stats.totalRequests) * 100;
    if (errorRate > 5) {
      criticalIssues.push(`错误率过高: ${errorRate.toFixed(1)}%`);
    } else if (errorRate > 1) {
      warnings.push(`错误率偏高: ${errorRate.toFixed(1)}%`);
    }

    if (criticalIssues.length > 0) {
      return chalk.red.bold(`🚨 DAY 2联调状态: 需要关注\n   ${criticalIssues.join('\n   ')}`);
    } else if (warnings.length > 0) {
      return chalk.yellow.bold(`⚠️ DAY 2联调状态: 基本正常，有改进空间\n   ${warnings.join('\n   ')}`);
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

export { MonitoringDashboard };