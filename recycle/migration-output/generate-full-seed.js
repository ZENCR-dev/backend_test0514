#!/usr/bin/env node
/**
 * 🌱 完整CSV数据处理脚本
 * 功能：基于medicines-seed-441.csv生成完整的Supabase种子数据
 * 特点：隐私合规、匿名化、GDPR/HIPAA兼容
 */

const fs = require('fs').promises;
const path = require('path');

// 数据生成配置
const CONFIG = {
  csvPath: '../test-data/medicines-seed-441.csv',
  outputPath: './full-medicines-seed-data.sql',
  userCount: {
    practitioners: 8,
    pharmacyOperators: 4,
    admins: 2
  },
  sampleData: {
    prescriptionsCount: 15,
    ordersCount: 12,
    apiLogsCount: 50
  }
};

// 匿名化用户名称
const ANONYMOUS_NAMES = {
  practitioners: [
    '匿名医师001', '匿名医师002', '匿名医师003', '匿名医师004',
    '匿名医师005', '匿名医师006', '匿名医师007', '匿名医师008'
  ],
  pharmacies: [
    '匿名药房001', '匿名药房002', '匿名药房003', '匿名药房004'
  ],
  admins: ['系统管理员001', '系统管理员002']
};

// 测试地址数据
const TEST_LOCATIONS = [
  { city: 'Auckland', region: 'Auckland', postal: '1010' },
  { city: 'Wellington', region: 'Wellington', postal: '6011' },
  { city: 'Christchurch', region: 'Canterbury', postal: '8011' },
  { city: 'Hamilton', region: 'Waikato', postal: '3204' }
];

/**
 * 解析CSV文件
 */
function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');
  const medicines = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length >= 9) {
      medicines.push({
        id: `med_${String(i).padStart(3, '0')}`,
        chinese_name: values[0],
        english_name: values[1],
        pinyin_name: values[2],
        sku: values[3],
        category: values[4],
        unit: values[5],
        requires_prescription: values[6] === '是' || values[6] === 'true',
        base_price: parseFloat(values[7]) || 0.1,
        status: values[8] || 'active'
      });
    }
  }
  
  return medicines;
}

/**
 * 生成药品数据SQL
 */
function generateMedicinesSQL(medicines) {
  let sql = `-- ==========================================\n`;
  sql += `-- 插入所有药品数据（${medicines.length}条记录）\n`;
  sql += `-- ==========================================\n\n`;
  
  sql += `INSERT INTO medicines (id, name, chinese_name, english_name, pinyin_name, sku, description, category, unit, requires_prescription, base_price, metadata, status, created_at, updated_at) VALUES\n`;
  
  const medicineValues = medicines.map((med, index) => {
    const description = `${med.chinese_name}传统中药材，仅用于测试环境`;
    const metadata = JSON.stringify({
      source: 'csv_import',
      imported_at: new Date().toISOString(),
      original_index: index + 1
    });
    
    return `  ('${med.id}', '${med.chinese_name}', '${med.chinese_name}', '${med.english_name}', '${med.pinyin_name}', '${med.sku}', '${description}', '${med.category}', '${med.unit}', ${med.requires_prescription}, ${med.base_price}, '${metadata}', '${med.status}', NOW(), NOW())`;
  });
  
  sql += medicineValues.join(',\n') + ';\n\n';
  
  return sql;
}

/**
 * 生成示例业务数据SQL
 */
function generateBusinessDataSQL() {
  let sql = `-- ==========================================\n`;
  sql += `-- 示例业务数据（匿名化）\n`;
  sql += `-- ==========================================\n\n`;
  
  // 生成API日志数据
  sql += `-- API调用日志数据\n`;
  sql += `INSERT INTO api_call_logs (id, endpoint, method, status_code, user_id, user_agent, ip, duration, request_size, response_size, metadata, created_at) VALUES\n`;
  
  const endpoints = [
    { path: '/api/medicines', method: 'GET', status: 200 },
    { path: '/api/medicines/search', method: 'POST', status: 200 },
    { path: '/api/prescriptions', method: 'GET', status: 200 },
    { path: '/api/prescriptions', method: 'POST', status: 201 },
    { path: '/api/orders', method: 'GET', status: 200 },
    { path: '/api/orders', method: 'POST', status: 201 },
    { path: '/api/orders/{id}', method: 'PUT', status: 200 },
    { path: '/api/payments', method: 'POST', status: 200 },
    { path: '/api/user/profile', method: 'GET', status: 200 },
    { path: '/api/user/profile', method: 'PUT', status: 200 }
  ];
  
  const apiLogs = [];
  for (let i = 0; i < CONFIG.sampleData.apiLogsCount; i++) {
    const endpoint = endpoints[i % endpoints.length];
    const duration = Math.floor(Math.random() * 2000) + 50;
    const requestSize = Math.floor(Math.random() * 5000) + 100;
    const responseSize = Math.floor(Math.random() * 10000) + 200;
    const hoursAgo = Math.floor(Math.random() * 720); // 过30天内
    
    apiLogs.push(`  ('log_${String(i + 1).padStart(3, '0')}', '${endpoint.path}', '${endpoint.method}', ${endpoint.status}, NULL, 'Test-Client/1.0.0', '127.0.0.1', ${duration}, ${requestSize}, ${responseSize}, '{"test_log": true, "anonymized": true}', NOW() - INTERVAL '${hoursAgo} hours')`);
  }
  
  sql += apiLogs.join(',\n') + ';\n\n';
  
  return sql;
}

/**
 * 生成完整的种子数据SQL文件
 */
function generateFullSeedSQL(medicines) {
  let sql = `-- 🌱 Supabase完整种子数据 - 隐私合规版本\n`;
  sql += `-- 生成时间: ${new Date().toISOString()}\n`;
  sql += `-- 数据源: medicines-seed-441.csv (${medicines.length}条记录)\n`;
  sql += `-- 特征: 完全匿名化，无患者隐私信息\n`;
  sql += `-- 注意: 仅用于测试和开发环境\n\n`;
  
  sql += `-- 禁用外键检查（插入期间）\n`;
  sql += `SET session_replication_role = replica;\n\n`;
  
  // 插入药品数据
  sql += generateMedicinesSQL(medicines);
  
  // 插入业务数据
  sql += generateBusinessDataSQL();
  
  // 用户数据说明
  sql += `-- ==========================================\n`;
  sql += `-- 用户数据插入说明\n`;
  sql += `-- ==========================================\n`;
  sql += `-- 注意：用户账户应通过 Supabase Auth API 创建\n`;
  sql += `-- 这里提供的是 user_profiles 数据的示例模板\n`;
  sql += `-- 实际使用时需要结合 auth.users 表的真实 UUID\n\n`;
  
  sql += `/*\n`;
  sql += `以下是用户相关数据的插入模板，需要先通过Supabase Auth API创建用户后使用：\n\n`;
  
  // 生成用户数据模板
  sql += `-- 插入用户配置文件数据（医师）\n`;
  sql += `INSERT INTO user_profiles (id, user_id, full_name, phone, license_number, specialization, clinic, created_at, updated_at) VALUES\n`;
  
  const practitionerProfiles = ANONYMOUS_NAMES.practitioners.map((name, index) => {
    const specializations = ['中医内科', '中医外科', '中医儿科', '中医骨科', '中医皮科', '中医精神科'];
    const spec = specializations[index % specializations.length];
    
    return `  ('profile_${String(index + 1).padStart(3, '0')}', 'auth_user_uuid_${String(index + 1).padStart(3, '0')}', '${name}', '+642${Math.floor(Math.random() * 9000000) + 1000000}', 'NZ${Math.floor(Math.random() * 900000) + 100000}', '${spec}', '匿名诊所${String(index + 1).padStart(3, '0')}', NOW(), NOW())`;
  });
  
  sql += practitionerProfiles.join(',\n') + ';\n\n';
  
  // 生成药房数据模板
  sql += `-- 插入药房数据\n`;
  sql += `INSERT INTO pharmacies (id, name, address, contact, license_info, operator_id, service_hours, status, created_at, updated_at) VALUES\n`;
  
  const pharmacyData = ANONYMOUS_NAMES.pharmacies.map((name, index) => {
    const location = TEST_LOCATIONS[index % TEST_LOCATIONS.length];
    const address = JSON.stringify({
      street: `${Math.floor(Math.random() * 999) + 1} Test Street`,
      city: location.city,
      region: location.region,
      postal_code: location.postal,
      country: 'New Zealand'
    });
    
    const contact = JSON.stringify({
      phone: `+64${Math.floor(Math.random() * 90000000) + 10000000}`,
      email: `pharmacy${index + 1}@testdomain.local`
    });
    
    const licenseInfo = JSON.stringify({
      license_number: `PH${Math.floor(Math.random() * 900000) + 100000}`,
      expiry_date: '2025-12-31'
    });
    
    const serviceHours = JSON.stringify({
      monday: '9:00-17:00',
      tuesday: '9:00-17:00',
      wednesday: '9:00-17:00',
      thursday: '9:00-17:00',
      friday: '9:00-17:00',
      saturday: '9:00-13:00',
      sunday: 'closed'
    });
    
    return `  ('pharmacy_${String(index + 1).padStart(3, '0')}', '${name}', '${address.replace(/'/g, "''")}', '${contact.replace(/'/g, "''")}', '${licenseInfo.replace(/'/g, "''")}', 'auth_user_uuid_${String(CONFIG.userCount.practitioners + index + 1).padStart(3, '0')}', '${serviceHours.replace(/'/g, "''")}', 'active', NOW(), NOW())`;
  });
  
  sql += pharmacyData.join(',\n') + ';\n\n';
  
  sql += `*/\n\n`;
  
  // 结束语句
  sql += `-- 重新启用外键检查\n`;
  sql += `SET session_replication_role = DEFAULT;\n\n`;
  
  sql += `-- ==========================================\n`;
  sql += `-- 数据插入完成报告\n`;
  sql += `-- ==========================================\n\n`;
  
  sql += `SELECT 'Supabase完整种子数据插入完成！' as status,\n`;
  sql += `       '药品: ${medicines.length} 条, API日志: ${CONFIG.sampleData.apiLogsCount} 条' as summary,\n`;
  sql += `       '基于medicines-seed-441.csv + 自动生成匿名业务数据' as description,\n`;
  sql += `       NOW() as completed_at;\n`;
  
  return sql;
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('🌱 开始处理CSV数据并生成完整种子数据...');
    
    // 读取CSV文件
    console.log(`📁 读取CSV文件: ${CONFIG.csvPath}`);
    const csvContent = await fs.readFile(CONFIG.csvPath, 'utf-8');
    
    // 解析药品数据
    const medicines = parseCSV(csvContent);
    console.log(`📊 解析到 ${medicines.length} 条药品记录`);
    
    // 生成SQL文件
    const sql = generateFullSeedSQL(medicines);
    
    // 保存文件
    await fs.writeFile(CONFIG.outputPath, sql);
    console.log(`✅ 完整种子数据已生成: ${CONFIG.outputPath}`);
    
    console.log('\n📊 数据统计:');
    console.log(`  - 药品记录: ${medicines.length} 条`);
    console.log(`  - API日志: ${CONFIG.sampleData.apiLogsCount} 条`);
    console.log(`  - 用户模板: ${CONFIG.userCount.practitioners + CONFIG.userCount.pharmacyOperators + CONFIG.userCount.admins} 个`);
    console.log(`  - 药房模板: ${CONFIG.userCount.pharmacyOperators} 个`);
    
    console.log('\n🎉 完整种子数据生成完成！');
    console.log('\n下一步操作：');
    console.log('1. 在Supabase中执行: psql 项目连接 -f full-medicines-seed-data.sql');
    console.log('2. 验证数据完整性: SELECT COUNT(*) FROM medicines;');
    console.log('3. 检查RLS策略正常工作');
    console.log('4. 测试API调用和权限控制');
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main();
}

module.exports = { parseCSV, generateMedicinesSQL, generateFullSeedSQL };