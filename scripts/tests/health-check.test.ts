/**
 * Enhanced Health Check Script - TDD Tests
 * 测试优先级: P0 > P1 > P2
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { EnhancedHealthChecker } from '../enhanced-health-check';

describe('Enhanced Health Check Script - P0 Core Tests', () => {
  let healthChecker: EnhancedHealthChecker;

  beforeAll(async () => {
    // TDD Red Phase: 这些测试应该先失败
    healthChecker = new EnhancedHealthChecker();
  });

  afterAll(async () => {
    // 清理资源
  });

  describe('P0: Database Connection Tests', () => {
    it('should connect to Supabase successfully', async () => {
      // Red Phase: 先写失败的测试
      const result = await healthChecker.checkDatabaseConnection();
      
      expect(result.status).toBe('PASS');
      expect(result.responseTime).toBeLessThan(1000);
      expect(result.details).toHaveProperty('prismaConnected', true);
      expect(result.details).toHaveProperty('tablesCount');
      expect(result.details.tablesCount).toBeGreaterThan(0);
    });

    it('should validate database schema integrity', async () => {
      const result = await healthChecker.checkDatabaseSchema();
      
      expect(result.status).toBe('PASS');
      expect(result.details).toHaveProperty('requiredTables');
      expect(result.details.requiredTables).toContain('users');
      expect(result.details.requiredTables).toContain('medicines');
      expect(result.details.requiredTables).toContain('orders');
    });
  });

  describe('P0: API Endpoints Tests', () => {
    it('should validate all authentication endpoints', async () => {
      const result = await healthChecker.checkAuthenticationEndpoints();
      
      expect(result.status).toBe('PASS');
      expect(result.details).toHaveProperty('loginEndpoint', 'OK');
      expect(result.details).toHaveProperty('refreshEndpoint', 'OK');
      expect(result.details).toHaveProperty('userInfoEndpoint', 'OK');
    });

    it('should validate medicines API with v1.2 format', async () => {
      const result = await healthChecker.checkMedicinesAPI();
      
      expect(result.status).toBe('PASS');
      expect(result.details).toHaveProperty('formatCompliance', true);
      expect(result.details).toHaveProperty('paginationWorking', true);
      expect(result.details).toHaveProperty('searchWorking', true);
    });

    it('should complete API checks within performance threshold', async () => {
      const result = await healthChecker.checkAPIPerformance();
      
      expect(result.status).toBe('PASS');
      expect(result.details.averageResponseTime).toBeLessThan(600);
      expect(result.details.maxResponseTime).toBeLessThan(1000);
    });
  });

  describe('P1: System Resources Tests', () => {
    it('should check system memory usage', async () => {
      const result = await healthChecker.checkSystemResources();
      
      expect(result.status).toBe('PASS');
      expect(result.details.memoryUsage).toBeLessThan(80); // < 80%
      expect(result.details.cpuUsage).toBeLessThan(90);    // < 90%
      expect(result.details.diskUsage).toBeLessThan(90);   // < 90%
    });
  });

  describe('P0: MCP Services Integration Tests', () => {
    it('should connect to all required MCP servers', async () => {
      const result = await healthChecker.checkMCPServices();
      
      expect(result.status).toBe('PASS');
      expect(result.details.mcpFeedbackEnhanced).toBe('CONNECTED');
      expect(result.details.mcpSequentialThinking).toBe('CONNECTED');
      expect(result.details.mcpSupabase).toBe('CONNECTED');
      expect(result.details.mcpContext7).toBe('CONNECTED');
    });
  });

  describe('P0: GUI Integration Tests', () => {
    it('should provide colorized console output', async () => {
      const result = await healthChecker.checkGUIFeatures();
      
      expect(result.status).toBe('PASS');
      expect(result.details.colorSupport).toBe(true);
      expect(result.details.progressBarSupport).toBe(true);
      expect(result.details.userInteractionSupport).toBe(true);
    });
  });
});

describe('Enhanced Health Check Script - P1 Integration Tests', () => {
  let healthChecker: EnhancedHealthChecker;

  beforeAll(async () => {
    healthChecker = new EnhancedHealthChecker();
  });

  it('should execute complete health check workflow', async () => {
    const result = await healthChecker.runCompleteHealthCheck();
    
    expect(result.overallStatus).toBe('EXCELLENT');
    expect(result.totalChecks).toBeGreaterThan(6);
    expect(result.passedChecks).toBe(result.totalChecks);
    expect(result.executionTime).toBeLessThan(60000); // < 60 seconds
  });

  it('should generate structured report', async () => {
    const report = await healthChecker.generateHealthReport();
    
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('overallHealth');
    expect(report).toHaveProperty('detailedResults');
    expect(report).toHaveProperty('performanceMetrics');
    expect(report.detailedResults).toBeInstanceOf(Array);
  });
});

describe('Enhanced Health Check Script - P2 Edge Cases', () => {
  let healthChecker: EnhancedHealthChecker;

  beforeAll(async () => {
    healthChecker = new EnhancedHealthChecker();
  });

  it('should handle network timeouts gracefully', async () => {
    // P2: 边界测试 - 网络超时处理
    const result = await healthChecker.checkWithTimeout(1); // 1ms timeout
    
    expect(result.status).toBe('FAIL');
    expect(result.issues).toContain('TIMEOUT');
  });

  it('should handle API server unavailable', async () => {
    // P2: 边界测试 - 服务器不可用
    const checker = new EnhancedHealthChecker('http://localhost:9999'); // 错误端口
    const result = await checker.checkDatabaseConnection();
    
    expect(result.status).toBe('FAIL');
    expect(result.issues).toContain('CONNECTION_REFUSED');
  });
}); 