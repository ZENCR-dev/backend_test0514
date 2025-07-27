#!/usr/bin/env tsx
/**
 * 数据质量检查脚本 v1.0
 * 用于TCM处方平台的数据完整性和一致性验证
 * 
 * 功能:
 * - 表结构检查
 * - 数据一致性验证
 * - 引用完整性检查
 * - 业务规则验证
 * - 数据分布分析
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

interface ValidationResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
  timestamp: Date;
}

interface QualityReport {
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    warningTests: number;
    overallStatus: string;
    executionTime: number;
  };
  results: ValidationResult[];
  metadata: {
    databaseVersion: string;
    schemaVersion: string;
    executedAt: Date;
    executedBy: string;
  };
}

class DataQualityChecker {
  private results: ValidationResult[] = [];
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
  }

  private async log(
    category: string,
    test: string,
    status: 'PASS' | 'FAIL' | 'WARNING',
    message: string,
    details?: any
  ) {
    const result: ValidationResult = {
      category,
      test,
      status,
      message,
      details,
      timestamp: new Date()
    };
    
    this.results.push(result);
    
    const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${statusIcon} [${category}] ${test}: ${message}`);
    
    if (details && (status === 'FAIL' || status === 'WARNING')) {
      console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
    }
  }

  // 1. 基础连接和表结构检查
  async checkDatabaseConnection(): Promise<void> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await this.log('CONNECTION', 'Database Connectivity', 'PASS', 'Database connection successful');
    } catch (error) {
      await this.log('CONNECTION', 'Database Connectivity', 'FAIL', 'Database connection failed', error);
    }
  }

  async checkTableExistence(): Promise<void> {
    const expectedTables = [
      'users', 'user_profiles', 'clinics', 'clinic_accounts', 'account_transactions',
      'medicines', 'pharmacies', 'pharmacy_inventory', 'orders', 'order_items',
      'payments', 'fulfillment_proofs', 'settlements', 'system_configs'
    ];

    try {
      const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `;
      
      const existingTables = tables.map(t => t.table_name);
      const missingTables = expectedTables.filter(table => !existingTables.includes(table));
      
      if (missingTables.length === 0) {
        await this.log('SCHEMA', 'Table Existence', 'PASS', 
          `All ${expectedTables.length} expected tables exist`);
      } else {
        await this.log('SCHEMA', 'Table Existence', 'FAIL', 
          `Missing tables: ${missingTables.join(', ')}`, { missingTables });
      }
    } catch (error) {
      await this.log('SCHEMA', 'Table Existence', 'FAIL', 'Failed to check table existence', error);
    }
  }

  // 2. 数据一致性检查
  async checkUserProfileConsistency(): Promise<void> {
    try {
      const usersWithoutProfiles = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count 
        FROM users u 
        LEFT JOIN user_profiles up ON u.id = up.user_id 
        WHERE up.user_id IS NULL
      `;

      const count = Number(usersWithoutProfiles[0]?.count || 0);
      
      if (count === 0) {
        await this.log('CONSISTENCY', 'User Profile Mapping', 'PASS', 
          'All users have corresponding profiles');
      } else {
        await this.log('CONSISTENCY', 'User Profile Mapping', 'WARNING', 
          `${count} users missing profiles`, { usersWithoutProfiles: count });
      }
    } catch (error) {
      await this.log('CONSISTENCY', 'User Profile Mapping', 'FAIL', 
        'Failed to check user-profile consistency', error);
    }
  }

  async checkClinicAccountConsistency(): Promise<void> {
    try {
      const clinicsWithoutAccounts = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count 
        FROM clinics c 
        LEFT JOIN clinic_accounts ca ON c.id = ca.clinic_id 
        WHERE ca.clinic_id IS NULL
      `;

      const count = Number(clinicsWithoutAccounts[0]?.count || 0);
      
      if (count === 0) {
        await this.log('CONSISTENCY', 'Clinic Account Mapping', 'PASS', 
          'All clinics have corresponding accounts');
      } else {
        await this.log('CONSISTENCY', 'Clinic Account Mapping', 'FAIL', 
          `${count} clinics missing accounts`, { clinicsWithoutAccounts: count });
      }
    } catch (error) {
      await this.log('CONSISTENCY', 'Clinic Account Mapping', 'FAIL', 
        'Failed to check clinic-account consistency', error);
    }
  }

  // 3. 引用完整性检查
  async checkForeignKeyIntegrity(): Promise<void> {
    try {
      // 检查订单->用户(从业者)的引用
      const orphanedOrdersPractitioner = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count 
        FROM orders o 
        LEFT JOIN users u ON o.practitioner_id = u.id 
        WHERE u.id IS NULL
      `;
      
      const practitionerCount = Number(orphanedOrdersPractitioner[0]?.count || 0);
      if (practitionerCount === 0) {
        await this.log('INTEGRITY', 'Orders -> Users (practitioner)', 'PASS', 'No orphaned records found');
      } else {
        await this.log('INTEGRITY', 'Orders -> Users (practitioner)', 'FAIL', 
          `${practitionerCount} orphaned records found`, { orphanedRecords: practitionerCount });
      }
    } catch (error) {
      await this.log('INTEGRITY', 'Orders -> Users (practitioner)', 'FAIL', 
        'Failed to check foreign key integrity', error);
    }

    try {
      // 检查订单->用户(患者)的引用
      const orphanedOrdersPatient = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count 
        FROM orders o 
        LEFT JOIN users u ON o.patient_id = u.id 
        WHERE o.patient_id IS NOT NULL AND u.id IS NULL
      `;
      
      const patientCount = Number(orphanedOrdersPatient[0]?.count || 0);
      if (patientCount === 0) {
        await this.log('INTEGRITY', 'Orders -> Users (patient)', 'PASS', 'No orphaned records found');
      } else {
        await this.log('INTEGRITY', 'Orders -> Users (patient)', 'FAIL', 
          `${patientCount} orphaned records found`, { orphanedRecords: patientCount });
      }
    } catch (error) {
      await this.log('INTEGRITY', 'Orders -> Users (patient)', 'FAIL', 
        'Failed to check foreign key integrity', error);
    }

    try {
      // 检查订单项->订单的引用
      const orphanedOrderItems = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count 
        FROM order_items oi 
        LEFT JOIN orders o ON oi.order_id = o.id 
        WHERE o.id IS NULL
      `;
      
      const orderItemsCount = Number(orphanedOrderItems[0]?.count || 0);
      if (orderItemsCount === 0) {
        await this.log('INTEGRITY', 'Order Items -> Orders', 'PASS', 'No orphaned records found');
      } else {
        await this.log('INTEGRITY', 'Order Items -> Orders', 'FAIL', 
          `${orderItemsCount} orphaned records found`, { orphanedRecords: orderItemsCount });
      }
    } catch (error) {
      await this.log('INTEGRITY', 'Order Items -> Orders', 'FAIL', 
        'Failed to check foreign key integrity', error);
    }

    try {
      // 检查订单项->药品的引用
      const orphanedOrderItemsMedicines = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count 
        FROM order_items oi 
        LEFT JOIN medicines m ON oi.medicine_id = m.id 
        WHERE m.id IS NULL
      `;
      
      const medicinesCount = Number(orphanedOrderItemsMedicines[0]?.count || 0);
      if (medicinesCount === 0) {
        await this.log('INTEGRITY', 'Order Items -> Medicines', 'PASS', 'No orphaned records found');
      } else {
        await this.log('INTEGRITY', 'Order Items -> Medicines', 'FAIL', 
          `${medicinesCount} orphaned records found`, { orphanedRecords: medicinesCount });
      }
    } catch (error) {
      await this.log('INTEGRITY', 'Order Items -> Medicines', 'FAIL', 
        'Failed to check foreign key integrity', error);
    }

    try {
      // 检查药房库存->药房的引用
      const orphanedInventory = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count 
        FROM pharmacy_inventory pi 
        LEFT JOIN pharmacies p ON pi.pharmacy_id = p.id 
        WHERE p.id IS NULL
      `;
      
      const inventoryCount = Number(orphanedInventory[0]?.count || 0);
      if (inventoryCount === 0) {
        await this.log('INTEGRITY', 'Pharmacy Inventory -> Pharmacies', 'PASS', 'No orphaned records found');
      } else {
        await this.log('INTEGRITY', 'Pharmacy Inventory -> Pharmacies', 'FAIL', 
          `${inventoryCount} orphaned records found`, { orphanedRecords: inventoryCount });
      }
    } catch (error) {
      await this.log('INTEGRITY', 'Pharmacy Inventory -> Pharmacies', 'FAIL', 
        'Failed to check foreign key integrity', error);
    }
  }

  // 4. 业务规则验证
  async checkBusinessRules(): Promise<void> {
    // 检查用户角色有效性
    try {
      const invalidRoles = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE role NOT IN ('practitioner', 'patient', 'pharmacy_operator', 'admin')
      `;

      const count = Number(invalidRoles[0]?.count || 0);
      if (count === 0) {
        await this.log('BUSINESS', 'User Role Validation', 'PASS', 'All user roles are valid');
      } else {
        await this.log('BUSINESS', 'User Role Validation', 'FAIL', 
          `${count} users with invalid roles`, { invalidRoles: count });
      }
    } catch (error) {
      await this.log('BUSINESS', 'User Role Validation', 'FAIL', 
        'Failed to validate user roles', error);
    }

    // 检查订单金额一致性
    try {
      const inconsistentOrders = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count 
        FROM orders o 
        WHERE o.total_amount != (
          SELECT COALESCE(SUM(oi.total_price), 0) 
          FROM order_items oi 
          WHERE oi.order_id = o.id
        )
      `;

      const count = Number(inconsistentOrders[0]?.count || 0);
      if (count === 0) {
        await this.log('BUSINESS', 'Order Amount Consistency', 'PASS', 
          'All order amounts match item totals');
      } else {
        await this.log('BUSINESS', 'Order Amount Consistency', 'FAIL', 
          `${count} orders with inconsistent amounts`, { inconsistentOrders: count });
      }
    } catch (error) {
      await this.log('BUSINESS', 'Order Amount Consistency', 'FAIL', 
        'Failed to check order amount consistency', error);
    }

    // 检查账户余额逻辑
    try {
      const invalidBalances = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count 
        FROM clinic_accounts 
        WHERE available_credit != (credit_limit - used_credit) 
        OR available_credit < 0
      `;

      const count = Number(invalidBalances[0]?.count || 0);
      if (count === 0) {
        await this.log('BUSINESS', 'Account Balance Logic', 'PASS', 
          'All account balances are logically correct');
      } else {
        await this.log('BUSINESS', 'Account Balance Logic', 'FAIL', 
          `${count} accounts with invalid balance calculations`, { invalidBalances: count });
      }
    } catch (error) {
      await this.log('BUSINESS', 'Account Balance Logic', 'FAIL', 
        'Failed to check account balance logic', error);
    }
  }

  // 5. 数据分布和统计检查
  async checkDataDistribution(): Promise<void> {
    try {
      // 用户分布统计
      const userStats = await prisma.$queryRaw<Array<{ role: string, count: number }>>`
        SELECT role, COUNT(*) as count 
        FROM users 
        GROUP BY role 
        ORDER BY count DESC
      `;

      await this.log('STATISTICS', 'User Role Distribution', 'PASS', 
        'User role distribution analysis complete', userStats);

      // 订单状态分布
      const orderStats = await prisma.$queryRaw<Array<{ status: string, count: number }>>`
        SELECT status, COUNT(*) as count 
        FROM orders 
        GROUP BY status 
        ORDER BY count DESC
      `;

      await this.log('STATISTICS', 'Order Status Distribution', 'PASS', 
        'Order status distribution analysis complete', orderStats);

      // 药品状态检查
      const medicineStats = await prisma.$queryRaw<Array<{ status: string, count: number }>>`
        SELECT status, COUNT(*) as count 
        FROM medicines 
        GROUP BY status 
        ORDER BY count DESC
      `;

      await this.log('STATISTICS', 'Medicine Status Distribution', 'PASS', 
        'Medicine status distribution analysis complete', medicineStats);

    } catch (error) {
      await this.log('STATISTICS', 'Data Distribution Analysis', 'FAIL', 
        'Failed to analyze data distribution', error);
    }
  }

  // 6. 数据质量特定检查
  async checkDataQualityIssues(): Promise<void> {
    // 检查用户邮箱空值
    try {
      const usersWithNullEmail = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM users WHERE email IS NULL OR email = ''
      `;
      
      const emailCount = Number(usersWithNullEmail[0]?.count || 0);
      if (emailCount === 0) {
        await this.log('QUALITY', 'users.email Null Check', 'PASS', 'No null or invalid values found');
      } else {
        await this.log('QUALITY', 'users.email Null Check', 'WARNING', 
          `${emailCount} records with null/invalid values`, { invalidRecords: emailCount });
      }
    } catch (error) {
      await this.log('QUALITY', 'users.email Null Check', 'FAIL', 
        'Failed to check user email nulls', error);
    }

    // 检查药品名称空值
    try {
      const medicinesWithNullName = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM medicines WHERE name IS NULL OR name = ''
      `;
      
      const medicineCount = Number(medicinesWithNullName[0]?.count || 0);
      if (medicineCount === 0) {
        await this.log('QUALITY', 'medicines.name Null Check', 'PASS', 'No null or invalid values found');
      } else {
        await this.log('QUALITY', 'medicines.name Null Check', 'WARNING', 
          `${medicineCount} records with null/invalid values`, { invalidRecords: medicineCount });
      }
    } catch (error) {
      await this.log('QUALITY', 'medicines.name Null Check', 'FAIL', 
        'Failed to check medicine name nulls', error);
    }

    // 检查药房名称空值
    try {
      const pharmaciesWithNullName = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM pharmacies WHERE name IS NULL OR name = ''
      `;
      
      const pharmacyCount = Number(pharmaciesWithNullName[0]?.count || 0);
      if (pharmacyCount === 0) {
        await this.log('QUALITY', 'pharmacies.name Null Check', 'PASS', 'No null or invalid values found');
      } else {
        await this.log('QUALITY', 'pharmacies.name Null Check', 'WARNING', 
          `${pharmacyCount} records with null/invalid values`, { invalidRecords: pharmacyCount });
      }
    } catch (error) {
      await this.log('QUALITY', 'pharmacies.name Null Check', 'FAIL', 
        'Failed to check pharmacy name nulls', error);
    }

    // 检查订单金额
    try {
      const ordersWithInvalidAmount = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM orders WHERE total_amount IS NULL OR total_amount < 0
      `;
      
      const orderCount = Number(ordersWithInvalidAmount[0]?.count || 0);
      if (orderCount === 0) {
        await this.log('QUALITY', 'orders.total_amount Null Check', 'PASS', 'No null or invalid values found');
      } else {
        await this.log('QUALITY', 'orders.total_amount Null Check', 'WARNING', 
          `${orderCount} records with null/invalid values`, { invalidRecords: orderCount });
      }
    } catch (error) {
      await this.log('QUALITY', 'orders.total_amount Null Check', 'FAIL', 
        'Failed to check order amount nulls', error);
    }

    // 检查重复数据
    try {
      const duplicateEmail = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count 
        FROM (
          SELECT email, COUNT(*) 
          FROM users 
          WHERE email IS NOT NULL AND email != ''
          GROUP BY email 
          HAVING COUNT(*) > 1
        ) duplicates
      `;

      const count = Number(duplicateEmail[0]?.count || 0);
      if (count === 0) {
        await this.log('QUALITY', 'Duplicate Email Check', 'PASS', 'No duplicate emails found');
      } else {
        await this.log('QUALITY', 'Duplicate Email Check', 'WARNING', 
          `${count} duplicate email addresses found`, { duplicateEmails: count });
      }
    } catch (error) {
      await this.log('QUALITY', 'Duplicate Data Check', 'FAIL', 
        'Failed to check for duplicate data', error);
    }
  }

  // 7. 性能相关检查
  async checkPerformanceMetrics(): Promise<void> {
    try {
      // 检查表大小 - 使用更兼容的查询
      const tableSizes = await prisma.$queryRaw<Array<{ 
        table_name: string, 
        size_pretty: string 
      }>>`
        SELECT 
          t.table_name,
          pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name)))::text as size_pretty
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ORDER BY pg_total_relation_size(quote_ident(t.table_name)) DESC
      `;

      await this.log('PERFORMANCE', 'Table Size Analysis', 'PASS', 
        'Table size analysis complete', tableSizes);

      // 简化的表行数统计
      const rowCounts = await prisma.$queryRaw<Array<{
        table_name: string,
        row_count: number
      }>>`
        SELECT 
          'users' as table_name,
          COUNT(*) as row_count
        FROM users
        UNION ALL
        SELECT 
          'medicines' as table_name,
          COUNT(*) as row_count
        FROM medicines
        UNION ALL
        SELECT 
          'orders' as table_name,
          COUNT(*) as row_count
        FROM orders
      `;

      await this.log('PERFORMANCE', 'Row Count Analysis', 'PASS', 
        'Row count analysis complete', rowCounts);

    } catch (error) {
      await this.log('PERFORMANCE', 'Performance Metrics', 'FAIL', 
        'Failed to analyze performance metrics', error);
    }
  }

  // 生成质量报告
  async generateReport(): Promise<QualityReport> {
    const endTime = new Date();
    const executionTime = endTime.getTime() - this.startTime.getTime();

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARNING').length;

    const overallStatus = failed > 0 ? 'CRITICAL' : warnings > 0 ? 'WARNING' : 'EXCELLENT';

    return {
      summary: {
        totalTests: this.results.length,
        passedTests: passed,
        failedTests: failed,
        warningTests: warnings,
        overallStatus,
        executionTime
      },
      results: this.results,
      metadata: {
        databaseVersion: 'PostgreSQL',
        schemaVersion: '1.0',
        executedAt: endTime,
        executedBy: 'Data Quality Checker v1.0'
      }
    };
  }

  async runAllChecks(): Promise<QualityReport> {
    console.log('🔍 Starting Data Quality Check...\n');

    // 执行所有检查
    await this.checkDatabaseConnection();
    await this.checkTableExistence();
    await this.checkUserProfileConsistency();
    await this.checkClinicAccountConsistency();
    await this.checkForeignKeyIntegrity();
    await this.checkBusinessRules();
    await this.checkDataDistribution();
    await this.checkDataQualityIssues();
    await this.checkPerformanceMetrics();

    const report = await this.generateReport();
    
    console.log('\n📊 Data Quality Check Summary:');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passedTests} ✅`);
    console.log(`Failed: ${report.summary.failedTests} ❌`);
    console.log(`Warnings: ${report.summary.warningTests} ⚠️`);
    console.log(`Overall Status: ${report.summary.overallStatus}`);
    console.log(`Execution Time: ${report.summary.executionTime}ms`);

    return report;
  }
}

// 主执行函数
async function main() {
  const checker = new DataQualityChecker();
  
  try {
    const report = await checker.runAllChecks();
    
    // 保存报告到文件
    const fs = await import('fs/promises');
    const reportPath = `scripts/validation/data-quality-report-${new Date().toISOString().split('T')[0]}.json`;
    
    // 处理BigInt序列化问题
    const reportJson = JSON.stringify(report, (key, value) => {
      return typeof value === 'bigint' ? value.toString() : value;
    }, 2);
    
    await fs.writeFile(reportPath, reportJson);
    
    console.log(`\n📄 Report saved to: ${reportPath}`);
    
    // 根据结果设置退出代码
    process.exit(report.summary.failedTests > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Data quality check failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

export { DataQualityChecker, type QualityReport, type ValidationResult };