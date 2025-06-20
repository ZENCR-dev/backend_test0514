import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
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
      this.logger.error(`⚠️ CRITICAL: ${url} took ${duration}ms (threshold: ${thresholds.critical}ms)`);
    } else if (duration > thresholds.warning) {
      this.logger.warn(`⚠️ WARNING: ${url} took ${duration}ms (threshold: ${thresholds.warning}ms)`);
    } else if (this.config.monitoring.logLevel === 'debug') {
      this.logger.debug(`✅ OK: ${url} took ${duration}ms`);
    }
  }

  private flushMetrics() {
    if (this.metricsBuffer.length === 0) return;

    try {
      const logFile = join(process.cwd(), 'logs', 'monitoring', `performance-${new Date().toISOString().split('T')[0]}.jsonl`);
      const logData = this.metricsBuffer.map(m => JSON.stringify(m)).join('\n') + '\n';
      
      appendFileSync(logFile, logData);
      
      this.logger.log(`📊 Flushed ${this.metricsBuffer.length} performance metrics`);
      this.metricsBuffer = [];
      this.lastFlush = Date.now();
    } catch (error) {
      this.logger.error('Failed to flush performance metrics:', error);
    }
  }
}