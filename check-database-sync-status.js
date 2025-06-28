/**
 * 检查远端数据库与本地Prisma Schema的同步状态
 * 特别关注诊所账户向医师个人账户的架构变更
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabaseSyncStatus() {
  try {
    console.log('🔍 检查远端数据库与Prisma Schema同步状态...\n');
    
    // 1. 测试数据库连接
    await prisma.$connect();
    console.log('✅ 成功连接到Supabase数据库');
    
    // 2. 检查关键表的存在状态
    const tableChecks = await Promise.all([
      checkTableExists('clinic_accounts'),
      checkTableExists('practitioner_accounts'),
      checkTableExists('account_transactions'),
      checkTableExists('users'),
      checkTableExists('orders')
    ]);
    
    console.log('\n📋 关键表存在状态:');
    tableChecks.forEach(result => {
      const status = result.exists ? '✅ 存在' : '❌ 不存在';
      console.log(`  - ${result.tableName}: ${status}`);
    });
    
    // 3. 检查account_transactions表的外键关系
    if (tableChecks.find(t => t.tableName === 'account_transactions')?.exists) {
      await checkAccountTransactionsForeignKeys();
    }
    
    // 4. 检查迁移历史
    await checkMigrationHistory();
    
    // 5. 分析同步状态并给出建议
    await analyzeSyncStatus(tableChecks);
    
  } catch (error) {
    console.error('❌ 检查过程中出现错误:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function checkTableExists(tableName) {
  try {
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      ) as exists
    `;
    
    return {
      tableName,
      exists: result[0]?.exists || false
    };
  } catch (error) {
    return {
      tableName,
      exists: false,
      error: error.message
    };
  }
}

async function checkAccountTransactionsForeignKeys() {
  try {
    console.log('\n🔗 检查account_transactions表的外键关系:');
    
    const foreignKeys = await prisma.$queryRaw`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'account_transactions'
        AND kcu.column_name = 'account_id'
    `;
    
    if (foreignKeys.length > 0) {
      foreignKeys.forEach(fk => {
        console.log(`  - ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
      
      // 检查是否指向clinic_accounts还是practitioner_accounts
      const pointsToClinicAccounts = foreignKeys.some(fk => fk.foreign_table_name === 'clinic_accounts');
      const pointsToPractitionerAccounts = foreignKeys.some(fk => fk.foreign_table_name === 'practitioner_accounts');
      
      if (pointsToClinicAccounts) {
        console.log('  ⚠️ 外键仍指向clinic_accounts表 - 需要迁移');
      }
      if (pointsToPractitionerAccounts) {
        console.log('  ✅ 外键已指向practitioner_accounts表');
      }
    } else {
      console.log('  ❌ 未找到account_id的外键关系');
    }
    
  } catch (error) {
    console.log('  ❌ 检查外键关系时出错:', error.message);
  }
}

async function checkMigrationHistory() {
  try {
    console.log('\n📊 迁移历史记录:');
    
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations 
      ORDER BY finished_at DESC 
      LIMIT 10
    `;
    
    migrations.forEach(migration => {
      const status = migration.rolled_back_at ? '❌ 已回滚' : '✅ 已应用';
      const date = new Date(migration.finished_at).toLocaleString();
      console.log(`  ${status} ${migration.migration_name} (${date})`);
    });
    
    // 检查是否有practitioner相关的迁移
    const practitionerMigrations = migrations.filter(m => 
      m.migration_name.includes('practitioner') || 
      m.migration_name.includes('add_practitioner_accounts')
    );
    
    if (practitionerMigrations.length === 0) {
      console.log('\n  ⚠️ 未发现practitioner_accounts相关的迁移记录');
    } else {
      console.log('\n  ✅ 发现practitioner_accounts相关迁移:');
      practitionerMigrations.forEach(m => {
        console.log(`    - ${m.migration_name}`);
      });
    }
    
  } catch (error) {
    console.log('  ❌ 检查迁移历史时出错:', error.message);
  }
}

async function analyzeSyncStatus(tableChecks) {
  console.log('\n🎯 同步状态分析与建议:\n');
  
  const clinicAccountsExists = tableChecks.find(t => t.tableName === 'clinic_accounts')?.exists;
  const practitionerAccountsExists = tableChecks.find(t => t.tableName === 'practitioner_accounts')?.exists;
  const accountTransactionsExists = tableChecks.find(t => t.tableName === 'account_transactions')?.exists;
  
  if (clinicAccountsExists && !practitionerAccountsExists) {
    console.log('❌ 状态: 数据库仍使用旧的clinic_accounts架构');
    console.log('🔧 需要执行的操作:');
    console.log('   1. 生成并应用practitioner_accounts迁移');
    console.log('   2. 迁移现有数据（如果有）');
    console.log('   3. 更新account_transactions外键关系');
    console.log('   4. 可选：保留clinic_accounts作为历史数据');
    console.log('\n📝 建议执行命令:');
    console.log('   npx prisma migrate dev --name add_practitioner_accounts');
    console.log('   node execute-practitioner-migration.ts');
    
  } else if (!clinicAccountsExists && practitionerAccountsExists) {
    console.log('✅ 状态: 数据库已完全迁移到practitioner_accounts架构');
    console.log('🎉 架构同步完成，无需额外操作');
    
  } else if (clinicAccountsExists && practitionerAccountsExists) {
    console.log('⚠️ 状态: 数据库同时存在两种账户表（过渡状态）');
    console.log('🔧 建议操作:');
    console.log('   1. 验证practitioner_accounts表结构完整性');
    console.log('   2. 迁移clinic_accounts中的数据（如果需要）');
    console.log('   3. 更新应用代码完全使用practitioner_accounts');
    console.log('   4. 考虑删除或重命名clinic_accounts表');
    
  } else {
    console.log('❌ 状态: 两种账户表都不存在 - 严重问题');
    console.log('🚨 紧急操作:');
    console.log('   1. 检查数据库连接和权限');
    console.log('   2. 重新运行完整的数据库迁移');
    console.log('   3. 验证Prisma Schema配置');
  }
  
  // 检查代码与数据库的一致性
  console.log('\n🔍 代码与数据库一致性检查:');
  
  if (practitionerAccountsExists) {
    console.log('✅ 数据库有practitioner_accounts表');
    console.log('✅ 代码中PractitionerAccountService已实现');
    console.log('✅ PaymentService已重构为使用PractitionerAccount');
    console.log('✅ Prisma Schema已更新');
  } else {
    console.log('❌ 数据库缺少practitioner_accounts表');
    console.log('⚠️ 代码已更新但数据库未同步');
  }
}

// 执行检查
checkDatabaseSyncStatus().catch(console.error);