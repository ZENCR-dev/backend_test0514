/**
 * 🌱 种子数据生成工具
 * 复用价值: 75% (数据生成逻辑和业务规则)
 * 迁移目标: 隐私合规的匹名测试数据
 * 适配要求: 基于medicines-seed-441.csv生成完整测试数据集
 * 
 * @migration Supabase-First架构适配
 * @privacy GDPR/HIPAA合规，完全匹名化
 * @performance 优化的数据库填充策略
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';
import { faker } from '@faker-js/faker';

interface MedicineRecord {
  name: string;
  chinese_name?: string;
  english_name?: string;
  pinyin_name?: string;
  sku: string;
  description?: string;
  category?: string;
  unit: string;
  requires_prescription: boolean;
  base_price: number;
  status: string;
}

interface SeedDataConfig {
  csvPath: string;
  outputDir: string;
  userCount: {
    practitioners: number;
    pharmacyOperators: number;
    admins: number;
  };
  dataDistribution: {
    prescriptionsPerPractitioner: number;
    ordersPerPrescription: number;
    medicinesPerPrescription: number;
  };
}

export class SeedDataGenerator {
  private readonly anonymousNames = [
    '匿名医师001', '匿名医师002', '匿名医师003',
    '匿名药房001', '匿名药房002', '匿名药房003',
    '测试用户001', '测试用户002', '测试用户003'
  ];

  private readonly testLocations = [
    { city: 'Auckland', region: 'Auckland' },
    { city: 'Wellington', region: 'Wellington' },
    { city: 'Christchurch', region: 'Canterbury' },
    { city: 'Hamilton', region: 'Waikato' },
    { city: 'Tauranga', region: 'Bay of Plenty' }
  ];

  /**
   * 从现有CSV文件生成完整测试数据集
   */
  async generateFromCSV(config: SeedDataConfig): Promise<void> {
    console.log('🌱 开始从 CSV 生成种子数据...');
    
    // 读取现有药品数据
    const medicines = await this.loadMedicinesFromCSV(config.csvPath);
    console.log(`📊 读取到 ${medicines.length} 个药品记录`);
    
    // 生成用户数据
    const { practitioners, pharmacyOperators, admins } = await this.generateUsers(config.userCount);
    
    // 生成药房数据
    const pharmacies = await this.generatePharmacies(pharmacyOperators);
    
    // 生成处方数据
    const prescriptions = await this.generatePrescriptions(
      practitioners,
      medicines,
      config.dataDistribution.prescriptionsPerPractitioner
    );
    
    // 生成订单数据
    const orders = await this.generateOrders(
      prescriptions,
      practitioners,
      pharmacies,
      config.dataDistribution.ordersPerPrescription
    );
    
    // 生成支付数据
    const payments = await this.generatePayments(orders);
    
    // 生成API日志数据
    const apiLogs = await this.generateApiLogs([...practitioners, ...pharmacyOperators, ...admins]);
    
    // 生成最终SQL文件
    const seedSQL = this.generateSeedSQL({
      medicines,
      practitioners,
      pharmacyOperators,
      admins,
      pharmacies,
      prescriptions,
      orders,
      payments,
      apiLogs
    });
    
    // 保存文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `${timestamp}_seed_data.sql`;
    const outputPath = join(config.outputDir, filename);
    
    await fs.writeFile(outputPath, seedSQL);
    
    console.log('✅ 种子数据生成完成');
    console.log(`📁 输出文件: ${outputPath}`);
    console.log(`📊 数据统计:`);
    console.log(`  - 药品: ${medicines.length} 条`);
    console.log(`  - 用户: ${practitioners.length + pharmacyOperators.length + admins.length} 条`);
    console.log(`  - 药房: ${pharmacies.length} 条`);
    console.log(`  - 处方: ${prescriptions.length} 条`);
    console.log(`  - 订单: ${orders.length} 条`);
    console.log(`  - 支付: ${payments.length} 条`);
    console.log(`  - API日志: ${apiLogs.length} 条`);
  }

  /**
   * 从CSV文件加载药品数据
   */
  private async loadMedicinesFromCSV(csvPath: string): Promise<MedicineRecord[]> {
    try {
      const csvContent = await fs.readFile(csvPath, 'utf-8');
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      
      return records.map((record: any, index: number) => ({
        id: uuidv4(),
        name: record.name || record.Name || `药品${index + 1}`,
        chinese_name: record.chinese_name || record.ChineseName || null,
        english_name: record.english_name || record.EnglishName || null,
        pinyin_name: record.pinyin_name || record.PinyinName || null,
        sku: record.sku || record.SKU || `MED${String(index + 1).padStart(6, '0')}`,
        description: record.description || record.Description || null,
        category: record.category || record.Category || '中药材',
        unit: record.unit || record.Unit || '克',
        requires_prescription: Boolean(record.requires_prescription) ?? true,
        base_price: parseFloat(record.base_price || record.BasePrice || (Math.random() * 50 + 1).toFixed(6)),
        metadata: {
          source: 'csv_import',
          imported_at: new Date().toISOString()
        },
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
    } catch (error) {
      console.error('❌ 读取CSV文件失败:', error);
      throw error;
    }
  }

  /**
   * 生成用户数据（全部匹名化）
   */
  private async generateUsers(counts: { practitioners: number; pharmacyOperators: number; admins: number }) {
    const practitioners = [];
    const pharmacyOperators = [];
    const admins = [];
    
    // 生成医师用户
    for (let i = 0; i < counts.practitioners; i++) {
      const userId = uuidv4();
      practitioners.push({
        id: userId,
        email: `practitioner${i + 1}@testdomain.local`,
        role: 'practitioner',
        status: 'approved',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profile: {
          id: uuidv4(),
          user_id: userId,
          full_name: `匿名医师${String(i + 1).padStart(3, '0')}`,
          phone: `+64${Math.floor(Math.random() * 9000000) + 1000000}`,
          license_number: `NZ${Math.floor(Math.random() * 900000) + 100000}`,
          specialization: faker.helpers.arrayElement(['中医内科', '中医外科', '中医儿科', '中医骨科']),
          clinic: `匿名诊所${String(i + 1).padStart(3, '0')}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        account: {
          id: uuidv4(),
          practitioner_id: userId,
          balance: Math.floor(Math.random() * 5000 * 100) / 100, // NZD cents precision
          credit_limit: Math.floor(Math.random() * 10000 * 100) / 100,
          used_credit: 0,
          status: 'active',
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      });
    }
    
    // 生成药房操作员
    for (let i = 0; i < counts.pharmacyOperators; i++) {
      const userId = uuidv4();
      pharmacyOperators.push({
        id: userId,
        email: `pharmacy${i + 1}@testdomain.local`,
        role: 'pharmacy_operator',
        status: 'approved',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profile: {
          id: uuidv4(),
          user_id: userId,
          full_name: `匿名药师${String(i + 1).padStart(3, '0')}`,
          phone: `+64${Math.floor(Math.random() * 9000000) + 1000000}`,
          license_number: `PH${Math.floor(Math.random() * 900000) + 100000}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      });
    }
    
    // 生成管理员
    for (let i = 0; i < counts.admins; i++) {
      const userId = uuidv4();
      admins.push({
        id: userId,
        email: `admin${i + 1}@testdomain.local`,
        role: 'admin',
        status: 'approved',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profile: {
          id: uuidv4(),
          user_id: userId,
          full_name: `系统管理员${String(i + 1).padStart(3, '0')}`,
          phone: `+64${Math.floor(Math.random() * 9000000) + 1000000}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      });
    }
    
    return { practitioners, pharmacyOperators, admins };
  }

  /**
   * 生成药房数据
   */
  private async generatePharmacies(pharmacyOperators: any[]): Promise<any[]> {
    return pharmacyOperators.map((operator, index) => {
      const location = this.testLocations[index % this.testLocations.length];
      return {
        id: uuidv4(),
        name: `匿名药房${String(index + 1).padStart(3, '0')}`,
        address: {
          street: `${Math.floor(Math.random() * 999) + 1} Test Street`,
          city: location.city,
          region: location.region,
          postal_code: `${Math.floor(Math.random() * 9000) + 1000}`,
          country: 'New Zealand'
        },
        contact: {
          phone: `+64${Math.floor(Math.random() * 9000000) + 1000000}`,
          email: `pharmacy${index + 1}@testdomain.local`
        },
        license_info: {
          license_number: `PH${Math.floor(Math.random() * 900000) + 100000}`,
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        operator_id: operator.id,
        service_hours: {
          monday: '9:00-17:00',
          tuesday: '9:00-17:00',
          wednesday: '9:00-17:00',
          thursday: '9:00-17:00',
          friday: '9:00-17:00',
          saturday: '9:00-13:00',
          sunday: 'closed'
        },
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });
  }

  /**
   * 生成处方数据
   */
  private async generatePrescriptions(
    practitioners: any[],
    medicines: MedicineRecord[],
    prescriptionsPerPractitioner: number
  ): Promise<any[]> {
    const prescriptions = [];
    
    for (const practitioner of practitioners) {
      for (let i = 0; i < prescriptionsPerPractitioner; i++) {
        const prescriptionId = `RX${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const selectedMedicines = faker.helpers.arrayElements(
          medicines,
          faker.number.int({ min: 3, max: 8 })
        );
        
        const totalAmount = selectedMedicines.reduce((sum, med) => {
          const weight = faker.number.float({ min: 5, max: 100, precision: 0.01 });
          return sum + (med.base_price * weight);
        }, 0);
        
        const prescription = {
          id: uuidv4(),
          prescription_id: prescriptionId,
          doctor_id: practitioner.id,
          status: faker.helpers.arrayElement(['DRAFT', 'PAID', 'FULFILLED', 'COMPLETED']),
          total_amount: Math.round(totalAmount * 100) / 100,
          notes: `匹名化处方笔记 - 仅用于测试`,
          version: 1,
          copies: faker.number.int({ min: 1, max: 3 }),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          payment_method: faker.helpers.arrayElement(['credit', 'account_balance']),
          payment_status: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          medicines: selectedMedicines.map(med => ({
            id: uuidv4(),
            prescription_id: prescriptionId,
            medicine_id: med.id,
            dosage_instructions: '匹名化用法用量 - 仅用于测试',
            weight: faker.number.float({ min: 5, max: 100, precision: 0.01 }),
            notes: '匹名化备注',
            created_at: new Date().toISOString()
          }))
        };
        
        prescriptions.push(prescription);
      }
    }
    
    return prescriptions;
  }

  /**
   * 生成订单数据
   */
  private async generateOrders(
    prescriptions: any[],
    practitioners: any[],
    pharmacies: any[],
    ordersPerPrescription: number
  ): Promise<any[]> {
    const orders = [];
    
    for (const prescription of prescriptions) {
      for (let i = 0; i < ordersPerPrescription; i++) {
        const order = {
          id: uuidv4(),
          platform_order_id: `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`,
          practitioner_id: prescription.doctor_id,
          status: faker.helpers.arrayElement(['PAID', 'FULFILLED', 'COMPLETED']),
          total_amount: prescription.total_amount,
          payment_status: 'completed',
          payment_method: 'credit_card',
          assigned_pharmacy_id: faker.helpers.arrayElement(pharmacies).id,
          copies: prescription.copies,
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        orders.push(order);
      }
    }
    
    return orders;
  }

  /**
   * 生成支付数据
   */
  private async generatePayments(orders: any[]): Promise<any[]> {
    return orders.map(order => ({
      id: uuidv4(),
      order_id: order.id,
      amount: order.total_amount,
      currency: 'NZD',
      payment_method: 'credit_card',
      provider: 'stripe',
      provider_transaction_id: `txn_${Math.random().toString(36).substr(2, 9)}`,
      status: 'completed',
      processed_at: new Date().toISOString(),
      metadata: {
        test_payment: true,
        anonymized: true
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
  }

  /**
   * 生成API日志数据
   */
  private async generateApiLogs(users: any[]): Promise<any[]> {
    const apiLogs = [];
    const endpoints = [
      '/api/prescriptions',
      '/api/orders',
      '/api/medicines',
      '/api/payments',
      '/api/user/profile'
    ];
    
    for (let i = 0; i < 1000; i++) {
      const user = faker.helpers.arrayElement(users);
      const endpoint = faker.helpers.arrayElement(endpoints);
      const method = faker.helpers.arrayElement(['GET', 'POST', 'PUT', 'DELETE']);
      
      apiLogs.push({
        id: uuidv4(),
        endpoint,
        method,
        status_code: faker.helpers.arrayElement([200, 201, 400, 401, 404, 500]),
        user_id: user.id,
        user_agent: 'Test-Client/1.0.0',
        ip: '127.0.0.1',
        duration: faker.number.int({ min: 50, max: 2000 }),
        request_size: faker.number.int({ min: 100, max: 5000 }),
        response_size: faker.number.int({ min: 200, max: 10000 }),
        metadata: {
          test_log: true,
          anonymized: true
        },
        created_at: faker.date.recent({ days: 30 }).toISOString()
      });
    }
    
    return apiLogs;
  }

  /**
   * 生成最终的SQL插入语句
   */
  private generateSeedSQL(data: any): string {
    let sql = `-- 🌱 Supabase种子数据 - 隐私合规版本
-- 生成时间: ${new Date().toISOString()}
-- 特征：完全匹名化，无患者隐私信息
-- 注意：仅用于测试和开发环境

-- 禁用外键检查（插入期间）
SET session_replication_role = replica;

-- 清空现有数据（谨慎使用）
-- TRUNCATE TABLE medicines, user_profiles, prescriptions, orders, payments, api_call_logs CASCADE;

`;
    
    // 插入药品数据
    sql += '-- 插入药品数据\n';
    sql += 'INSERT INTO medicines (id, name, chinese_name, english_name, pinyin_name, sku, description, category, unit, requires_prescription, base_price, metadata, status, created_at, updated_at) VALUES\n';
    
    const medicineValues = data.medicines.map((med: any) => 
      `('${med.id}', ${this.sqlEscape(med.name)}, ${this.sqlEscape(med.chinese_name)}, ${this.sqlEscape(med.english_name)}, ${this.sqlEscape(med.pinyin_name)}, '${med.sku}', ${this.sqlEscape(med.description)}, ${this.sqlEscape(med.category)}, '${med.unit}', ${med.requires_prescription}, ${med.base_price}, '${JSON.stringify(med.metadata)}', '${med.status}', '${med.created_at}', '${med.updated_at}')`
    ).join(',\n');
    
    sql += medicineValues + ';\n\n';
    
    // 插入用户数据（通过Supabase Auth API）
    sql += `-- 用户数据插入说明
-- 注意：用户账户应通过 Supabase Auth API 创建
-- 这里提供的是 user_profiles 数据的示例
-- 实际使用时需要结合 auth.users 表的真实 UUID

`;
    
    // 生成插入脚本脚手架
    sql += this.generateInsertScripts(data);
    
    // 重新启用外键检查
    sql += '\n-- 重新启用外键检查\n';
    sql += 'SET session_replication_role = DEFAULT;\n\n';
    
    // 更新序列
    sql += '-- 更新序列（如果使用自增主键）\n';
    sql += 'SELECT setval(pg_get_serial_sequence(\'medicines\', \'id\'), (SELECT MAX(id) FROM medicines));\n\n';
    
    sql += '-- 数据插入完成\n';
    sql += `-- 统计信息：
--   药品: ${data.medicines.length} 条
--   用户: ${data.practitioners.length + data.pharmacyOperators.length + data.admins.length} 条
--   药房: ${data.pharmacies.length} 条
--   处方: ${data.prescriptions.length} 条
--   订单: ${data.orders.length} 条
--   支付: ${data.payments.length} 条
--   API日志: ${data.apiLogs.length} 条
`;
    
    return sql;
  }

  /**
   * 生成插入脚本脚手架
   */
  private generateInsertScripts(data: any): string {
    return `-- ===========================================
-- 插入脚本脚手架
-- ===========================================
-- 以下是其他表的插入语句模板
-- 实际使用时需要根据 Supabase 项目的真实 auth.users.id 调整

/*
-- 插入用户配置文件数据
INSERT INTO user_profiles (id, user_id, full_name, phone, license_number, specialization, clinic, created_at, updated_at)
VALUES 
${data.practitioners.map((p: any) => 
  `  ('${p.profile.id}', '${p.id}', '${p.profile.full_name}', '${p.profile.phone}', '${p.profile.license_number}', '${p.profile.specialization}', '${p.profile.clinic}', '${p.profile.created_at}', '${p.profile.updated_at}')`
).join(',\n')};

-- 插入医师账户数据
INSERT INTO practitioner_accounts (id, practitioner_id, balance, credit_limit, used_credit, status, version, created_at, updated_at)
VALUES
${data.practitioners.map((p: any) =>
  `  ('${p.account.id}', '${p.id}', ${p.account.balance}, ${p.account.credit_limit}, ${p.account.used_credit}, '${p.account.status}', ${p.account.version}, '${p.account.created_at}', '${p.account.updated_at}')`
).join(',\n')};

-- 插入药房数据
INSERT INTO pharmacies (id, name, address, contact, license_info, operator_id, service_hours, status, created_at, updated_at)
VALUES
${data.pharmacies.map((p: any) =>
  `  ('${p.id}', '${p.name}', '${JSON.stringify(p.address)}', '${JSON.stringify(p.contact)}', '${JSON.stringify(p.license_info)}', '${p.operator_id}', '${JSON.stringify(p.service_hours)}', '${p.status}', '${p.created_at}', '${p.updated_at}')`
).join(',\n')};

-- 插入处方数据
INSERT INTO prescriptions (id, prescription_id, doctor_id, status, total_amount, notes, version, copies, expires_at, payment_method, payment_status, created_at, updated_at)
VALUES
${data.prescriptions.slice(0, 10).map((p: any) =>
  `  ('${p.id}', '${p.prescription_id}', '${p.doctor_id}', '${p.status}', ${p.total_amount}, '${p.notes}', ${p.version}, ${p.copies}, '${p.expires_at}', '${p.payment_method}', '${p.payment_status}', '${p.created_at}', '${p.updated_at}')`
).join(',\n')};

-- 更多数据请参考完整的生成脚本...
*/

-- 注意：以上代码被注释了，因为需要先通过 Supabase Auth API 创建用户
-- 然后才能插入相关数据
`;
  }

  /**
   * SQL字符串转义
   */
  private sqlEscape(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    return `'${String(value).replace(/'/g, "''")}'`;
  }
}

// CLI接口
export async function generateSeedData(
  csvPath: string,
  outputDir: string,
  config: Partial<SeedDataConfig> = {}
): Promise<void> {
  const generator = new SeedDataGenerator();
  
  const defaultConfig: SeedDataConfig = {
    csvPath,
    outputDir,
    userCount: {
      practitioners: 10,
      pharmacyOperators: 5,
      admins: 2
    },
    dataDistribution: {
      prescriptionsPerPractitioner: 5,
      ordersPerPrescription: 1,
      medicinesPerPrescription: 5
    },
    ...config
  };
  
  try {
    console.log('🚀 开始生成种子数据...');
    console.log(`📁 CSV文件: ${csvPath}`);
    console.log(`📁 输出目录: ${outputDir}`);
    
    await generator.generateFromCSV(defaultConfig);
    
    console.log('🎉 种子数据生成完成！');
    console.log('\n下一步操作：');
    console.log('1. 检查生成的SQL文件');
    console.log('2. 在Supabase中执行: psql -f seed_data.sql');
    console.log('3. 验证数据完整性和隐私合规性');
    console.log('4. 配置测试环境的RLS策略');
    
  } catch (error) {
    console.error('❌ 种子数据生成失败:', error);
    throw error;
  }
}