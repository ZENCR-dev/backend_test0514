/**
 * Database Health Checker
 * 实现 TDD 测试用例中的数据库连接和模式检查功能
 */

import { PrismaClient } from '@prisma/client';

export interface CheckResult {
  status: 'PASS' | 'FAIL';
  responseTime: number;
  details: any;
  issues: string[];
}

export class DatabaseChecker {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async checkDatabaseConnection(): Promise<CheckResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    
    try {
      // 测试数据库连接
      await this.prisma.$connect();
      
      // 执行简单查询验证连接
      const result = await this.prisma.$queryRaw`SELECT 1 as test`;
      
      // 获取表信息
      const tables = await this.prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
      
      const responseTime = Date.now() - startTime;
      
      // 验证响应时间
      if (responseTime > 1000) {
        issues.push(`数据库响应时间过长: ${responseTime}ms > 1000ms`);
      }
      
      return {
        status: issues.length === 0 ? 'PASS' : 'FAIL',
        responseTime,
        details: {
          prismaConnected: true,
          tablesCount: Array.isArray(tables) ? tables.length : 0,
          connectionTest: result,
          availableTables: tables
        },
        issues
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      issues.push(`数据库连接失败: ${error.message}`);
      
      return {
        status: 'FAIL',
        responseTime,
        details: {
          prismaConnected: false,
          tablesCount: 0,
          error: error.message
        },
        issues
      };
    }
  }

  async checkDatabaseSchema(): Promise<CheckResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    const requiredTables = ['users', 'medicines', 'orders', 'clinic_accounts'];
    
    try {
      // 获取所有表名
      const tablesQuery = await this.prisma.$queryRaw<Array<{table_name: string}>>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
      
      const existingTables = tablesQuery.map(t => t.table_name.toLowerCase());
      const missingTables = requiredTables.filter(table => 
        !existingTables.includes(table.toLowerCase())
      );
      
      if (missingTables.length > 0) {
        issues.push(`缺少必需的表: ${missingTables.join(', ')}`);
      }
      
      // 检查关键表的数据
      const dataChecks = [];
      
      if (existingTables.includes('medicines')) {
        const medicineCount = await this.prisma.medicine.count();
        dataChecks.push({ table: 'medicines', count: medicineCount });
        
        if (medicineCount === 0) {
          issues.push('medicines表为空，需要种子数据');
        }
      }
      
      if (existingTables.includes('users')) {
        const userCount = await this.prisma.user.count();
        dataChecks.push({ table: 'users', count: userCount });
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: issues.length === 0 ? 'PASS' : 'FAIL',
        responseTime,
        details: {
          requiredTables,
          existingTables,
          missingTables,
          dataChecks,
          schemaValid: missingTables.length === 0
        },
        issues
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      issues.push(`数据库模式检查失败: ${error.message}`);
      
      return {
        status: 'FAIL',
        responseTime,
        details: {
          requiredTables,
          schemaValid: false,
          error: error.message
        },
        issues
      };
    }
  }

  async checkSupabaseSpecific(): Promise<CheckResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    
    try {
      // 检查Supabase特定功能
      const supabaseInfo = await this.prisma.$queryRaw`
        SELECT 
          current_database() as database_name,
          current_user as current_user,
          version() as postgres_version
      `;
      
      // 检查RLS政策（Row Level Security）
      const rlsPolicies = await this.prisma.$queryRaw`
        SELECT schemaname, tablename, policyname, permissive
        FROM pg_policies 
        WHERE schemaname = 'public'
      `;
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'PASS',
        responseTime,
        details: {
          supabaseInfo,
          rlsPoliciesCount: Array.isArray(rlsPolicies) ? rlsPolicies.length : 0,
          rlsPolicies
        },
        issues
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      issues.push(`Supabase特定检查失败: ${error.message}`);
      
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

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
} 