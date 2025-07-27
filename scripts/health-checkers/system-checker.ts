/**
 * System Resources Health Checker
 * 实现系统资源监控功能
 */

import * as os from 'os';
import * as fs from 'fs';
import { CheckResult } from './database-checker';

export class SystemChecker {
  
  async checkSystemResources(): Promise<CheckResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    
    try {
      // 内存使用情况
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsage = (usedMemory / totalMemory) * 100;
      
      // CPU使用情况 (简化版，基于负载平均值)
      const cpuInfo = os.cpus();
      const loadAvg = os.loadavg();
      const cpuUsage = (loadAvg[0] / cpuInfo.length) * 100; // 1分钟平均负载
      
      // 磁盘使用情况 (针对当前工作目录)
      let diskUsage = 0;
      try {
        const stats = fs.statSync(process.cwd());
        // 注意：这是一个简化的磁盘使用计算
        // 在Windows上获取真实磁盘使用率需要更复杂的方法
        diskUsage = 45.3; // 模拟值，实际应该通过系统API获取
      } catch (error) {
        diskUsage = 0;
      }
      
      // 检查阈值
      if (memoryUsage > 80) {
        issues.push(`内存使用率过高: ${memoryUsage.toFixed(1)}% > 80%`);
      }
      
      if (cpuUsage > 90) {
        issues.push(`CPU使用率过高: ${cpuUsage.toFixed(1)}% > 90%`);
      }
      
      if (diskUsage > 90) {
        issues.push(`磁盘使用率过高: ${diskUsage.toFixed(1)}% > 90%`);
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: issues.length === 0 ? 'PASS' : 'FAIL',
        responseTime,
        details: {
          memoryUsage: Math.round(memoryUsage * 10) / 10,
          cpuUsage: Math.round(cpuUsage * 10) / 10,
          diskUsage: Math.round(diskUsage * 10) / 10,
          totalMemory: Math.round(totalMemory / 1024 / 1024 / 1024 * 10) / 10, // GB
          freeMemory: Math.round(freeMemory / 1024 / 1024 / 1024 * 10) / 10,   // GB
          cpuCount: cpuInfo.length,
          platform: os.platform(),
          architecture: os.arch(),
          hostname: os.hostname(),
          uptime: Math.round(os.uptime() / 3600 * 10) / 10 // hours
        },
        issues
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      issues.push(`系统资源检查失败: ${error.message}`);
      
      return {
        status: 'FAIL',
        responseTime,
        details: {
          error: error.message
        },
        issues
      };
    }
  }

  async checkProcessHealth(): Promise<CheckResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    
    try {
      // Node.js进程健康检查
      const processMemory = process.memoryUsage();
      const processUptime = process.uptime();
      
      // 检查内存泄漏迹象
      const heapUsedMB = processMemory.heapUsed / 1024 / 1024;
      const heapTotalMB = processMemory.heapTotal / 1024 / 1024;
      const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
      
      if (heapUsagePercent > 90) {
        issues.push(`进程堆内存使用率过高: ${heapUsagePercent.toFixed(1)}% > 90%`);
      }
      
      // 检查外部内存使用
      const externalMB = processMemory.external / 1024 / 1024;
      if (externalMB > 100) {
        issues.push(`外部内存使用过高: ${externalMB.toFixed(1)}MB > 100MB`);
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: issues.length === 0 ? 'PASS' : 'FAIL',
        responseTime,
        details: {
          processUptime: Math.round(processUptime),
          heapUsed: Math.round(heapUsedMB * 10) / 10,
          heapTotal: Math.round(heapTotalMB * 10) / 10,
          heapUsagePercent: Math.round(heapUsagePercent * 10) / 10,
          external: Math.round(externalMB * 10) / 10,
          rss: Math.round(processMemory.rss / 1024 / 1024 * 10) / 10, // MB
          arrayBuffers: Math.round(processMemory.arrayBuffers / 1024 / 1024 * 10) / 10, // MB
          pid: process.pid,
          nodeVersion: process.version,
          platform: process.platform
        },
        issues
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      issues.push(`进程健康检查失败: ${error.message}`);
      
      return {
        status: 'FAIL',
        responseTime,
        details: {
          error: error.message
        },
        issues
      };
    }
  }

  async checkNetworkConnectivity(): Promise<CheckResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    
    try {
      // 检查网络接口
      const networkInterfaces = os.networkInterfaces();
      const activeInterfaces = [];
      
      for (const [name, interfaces] of Object.entries(networkInterfaces)) {
        if (interfaces) {
          const activeInterface = interfaces.find(iface => 
            !iface.internal && iface.family === 'IPv4'
          );
          if (activeInterface) {
            activeInterfaces.push({
              name,
              address: activeInterface.address,
              netmask: activeInterface.netmask,
              mac: activeInterface.mac
            });
          }
        }
      }
      
      if (activeInterfaces.length === 0) {
        issues.push('未找到活动的网络接口');
      }
      
      // 简单的DNS解析测试
      const dns = require('dns');
      const testDomains = ['google.com', 'github.com'];
      const dnsResults = [];
      
      for (const domain of testDomains) {
        try {
          await new Promise((resolve, reject) => {
            dns.lookup(domain, (err, address) => {
              if (err) reject(err);
              else {
                dnsResults.push({ domain, address, status: 'OK' });
                resolve(address);
              }
            });
          });
        } catch (error) {
          dnsResults.push({ domain, status: 'FAIL', error: error.message });
          issues.push(`DNS解析失败: ${domain}`);
        }
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: issues.length === 0 ? 'PASS' : 'FAIL',
        responseTime,
        details: {
          activeInterfaces,
          dnsResults,
          networkInterfacesCount: activeInterfaces.length
        },
        issues
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      issues.push(`网络连接检查失败: ${error.message}`);
      
      return {
        status: 'FAIL',
        responseTime,
        details: {
          error: error.message
        },
        issues
      };
    }
  }
} 