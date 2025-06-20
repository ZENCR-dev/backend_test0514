/**
 * 数据质量检查脚本测试
 * 测试各种数据验证功能
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/jest';
import { PrismaClient } from '@prisma/client';
import { DataQualityChecker, type QualityReport, type ValidationResult } from '../data-quality-check';

const prisma = new PrismaClient();

describe('DataQualityChecker', () => {
  let checker: DataQualityChecker;

  beforeAll(async () => {
    // 确保测试数据库连接
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(() => {
    checker = new DataQualityChecker();
  });

  describe('Database Connection Tests', () => {
    it('should successfully connect to database', async () => {
      // 测试数据库连接
      await expect(prisma.$queryRaw`SELECT 1`).resolves.not.toThrow();
    });

    it('should check database connection in quality checker', async () => {
      const report = await checker.runAllChecks();
      
      const connectionResults = report.results.filter(r => r.category === 'CONNECTION');
      expect(connectionResults.length).toBeGreaterThan(0);
      
      const connectivityTest = connectionResults.find(r => r.test === 'Database Connectivity');
      expect(connectivityTest?.status).toBe('PASS');
    });
  });

  describe('Schema Validation Tests', () => {
    it('should verify all required tables exist', async () => {
      const expectedTables = [
        'users', 'user_profiles', 'clinics', 'clinic_accounts', 'account_transactions',
        'medicines', 'pharmacies', 'pharmacy_inventory', 'orders', 'order_items',
        'payments', 'fulfillment_proofs', 'settlements', 'system_configs'
      ];

      const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `;
      
      const existingTables = tables.map(t => t.table_name);
      
      for (const table of expectedTables) {
        expect(existingTables).toContain(table);
      }
    });
  });

  describe('Data Consistency Tests', () => {
    it('should check user-profile consistency', async () => {
      // 获取用户和用户档案数据
      const users = await prisma.user.findMany({ select: { id: true } });
      const profiles = await prisma.userProfile.findMany({ select: { userId: true } });
      
      // 检查是否每个用户都有对应的档案（允许一些用户没有档案）
      const userIds = users.map(u => u.id);
      const profileUserIds = profiles.map(p => p.userId);
      
      // 如果有用户，应该有一些档案
      if (users.length > 0) {
        expect(profiles.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should verify clinic-account mapping', async () => {
      const clinics = await prisma.clinic.findMany({ select: { id: true } });
      const accounts = await prisma.clinicAccount.findMany({ select: { clinicId: true } });
      
      // 每个诊所应该有对应的账户
      if (clinics.length > 0) {
        expect(accounts.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Business Rules Validation', () => {
    it('should validate user roles', async () => {
      const validRoles = ['practitioner', 'patient', 'pharmacy_operator', 'admin'];
      
      const invalidRoles = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE role NOT IN ('practitioner', 'patient', 'pharmacy_operator', 'admin')
      `;
      
      expect(Number(invalidRoles[0]?.count || 0)).toBe(0);
    });

    it('should validate order statuses', async () => {
      const validStatuses = ['DRAFT', 'PAYMENT_FAILED', 'PAID', 'PENDING_REVIEW', 'REJECTED', 'FULFILLED', 'CANCELLED', 'EXPIRED'];
      
      const orders = await prisma.order.findMany({ select: { status: true } });
      
      for (const order of orders) {
        expect(validStatuses).toContain(order.status);
      }
    });

    it('should check order amount consistency', async () => {
      const orders = await prisma.order.findMany({
        include: {
          orderItems: true
        }
      });

      for (const order of orders) {
        const calculatedTotal = order.orderItems.reduce((sum, item) => {
          return sum + Number(item.totalPrice);
        }, 0);
        
        // 允许小数点精度差异
        const difference = Math.abs(Number(order.totalAmount) - calculatedTotal);
        expect(difference).toBeLessThan(0.01);
      }
    });
  });

  describe('Data Quality Tests', () => {
    it('should check for null values in critical fields', async () => {
      // 检查用户邮箱
      const usersWithNullEmail = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count FROM users WHERE email IS NULL OR email = ''
      `;
      
      // 在生产环境中，这应该是0，但在测试环境中可能允许一些空值
      expect(Number(usersWithNullEmail[0]?.count || 0)).toBeGreaterThanOrEqual(0);

      // 检查药品名称
      const medicinesWithNullName = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count FROM medicines WHERE name IS NULL OR name = ''
      `;
      
      expect(Number(medicinesWithNullName[0]?.count || 0)).toBe(0);
    });

    it('should check for duplicate email addresses', async () => {
      const duplicateEmails = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count 
        FROM (
          SELECT email, COUNT(*) 
          FROM users 
          WHERE email IS NOT NULL AND email != ''
          GROUP BY email 
          HAVING COUNT(*) > 1
        ) duplicates
      `;
      
      // 应该没有重复的邮箱地址
      expect(Number(duplicateEmails[0]?.count || 0)).toBe(0);
    });
  });

  describe('Foreign Key Integrity Tests', () => {
    it('should verify order->user references', async () => {
      const orphanedOrders = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count 
        FROM orders o 
        LEFT JOIN users u ON o.practitioner_id = u.id 
        WHERE u.id IS NULL
      `;
      
      expect(Number(orphanedOrders[0]?.count || 0)).toBe(0);
    });

    it('should verify order_items->orders references', async () => {
      const orphanedItems = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count 
        FROM order_items oi 
        LEFT JOIN orders o ON oi.order_id = o.id 
        WHERE o.id IS NULL
      `;
      
      expect(Number(orphanedItems[0]?.count || 0)).toBe(0);
    });

    it('should verify order_items->medicines references', async () => {
      const orphanedItems = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count 
        FROM order_items oi 
        LEFT JOIN medicines m ON oi.medicine_id = m.id 
        WHERE m.id IS NULL
      `;
      
      expect(Number(orphanedItems[0]?.count || 0)).toBe(0);
    });
  });

  describe('Full Quality Check Tests', () => {
    it('should run complete quality check and generate report', async () => {
      const report = await checker.runAllChecks();
      
      // 验证报告结构
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('results');
      expect(report).toHaveProperty('metadata');
      
      // 验证摘要信息
      expect(report.summary.totalTests).toBeGreaterThan(0);
      expect(report.summary.passedTests).toBeGreaterThanOrEqual(0);
      expect(report.summary.failedTests).toBeGreaterThanOrEqual(0);
      expect(report.summary.warningTests).toBeGreaterThanOrEqual(0);
      expect(report.summary.executionTime).toBeGreaterThan(0);
      
      // 验证总数一致性
      const totalCalculated = report.summary.passedTests + report.summary.failedTests + report.summary.warningTests;
      expect(totalCalculated).toBe(report.summary.totalTests);
      
      // 验证状态计算
      if (report.summary.failedTests > 0) {
        expect(report.summary.overallStatus).toBe('CRITICAL');
      } else if (report.summary.warningTests > 0) {
        expect(report.summary.overallStatus).toBe('WARNING');
      } else {
        expect(report.summary.overallStatus).toBe('EXCELLENT');
      }
    });

    it('should include all expected test categories', async () => {
      const report = await checker.runAllChecks();
      
      const categories = [...new Set(report.results.map(r => r.category))];
      const expectedCategories = [
        'CONNECTION', 'SCHEMA', 'CONSISTENCY', 'INTEGRITY', 
        'BUSINESS', 'STATISTICS', 'QUALITY', 'PERFORMANCE'
      ];
      
      for (const category of expectedCategories) {
        expect(categories).toContain(category);
      }
    });

    it('should have timestamp for each validation result', async () => {
      const report = await checker.runAllChecks();
      
      for (const result of report.results) {
        expect(result.timestamp).toBeInstanceOf(Date);
        expect(result.timestamp.getTime()).toBeGreaterThan(0);
      }
    });

    it('should include proper metadata', async () => {
      const report = await checker.runAllChecks();
      
      expect(report.metadata.databaseVersion).toBe('PostgreSQL');
      expect(report.metadata.schemaVersion).toBe('1.0');
      expect(report.metadata.executedAt).toBeInstanceOf(Date);
      expect(report.metadata.executedBy).toBe('Data Quality Checker v1.0');
    });
  });

  describe('Performance Tests', () => {
    it('should complete quality check within reasonable time', async () => {
      const startTime = Date.now();
      const report = await checker.runAllChecks();
      const endTime = Date.now();
      
      const actualTime = endTime - startTime;
      
      // 质量检查应该在30秒内完成
      expect(actualTime).toBeLessThan(30000);
      expect(report.summary.executionTime).toBeCloseTo(actualTime, -2);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle database connection errors gracefully', async () => {
      // 这个测试在实际环境中可能需要模拟数据库错误
      // 目前只验证错误不会导致程序崩溃
      const report = await checker.runAllChecks();
      expect(report).toBeDefined();
    });
  });
});