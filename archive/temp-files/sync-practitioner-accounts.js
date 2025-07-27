/**
 * 同步practitioner_accounts表到远端数据库
 * 处理从clinic_accounts到practitioner_accounts的架构迁移
 */

require('dotenv').config();
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function syncPractitionerAccounts() {
  try {
    console.log('🚀 开始同步practitioner_accounts到远端数据库...\n');
    
    // 步骤1: 检查当前状态
    console.log('📋 步骤1: 检查当前数据库状态');
    await checkCurrentStatus();
    
    // 步骤2: 生成迁移文件
    console.log('\n📋 步骤2: 生成practitioner_accounts迁移');
    await generateMigration();
    
    // 步骤3: 应用迁移到远端数据库
    console.log('\n📋 步骤3: 应用迁移到远端数据库');
    await deployMigration();
    
    // 步骤4: 验证迁移结果
    console.log('\n📋 步骤4: 验证迁移结果');
    await verifyMigration();
    
    console.log('\n🎉 practitioner_accounts同步完成！');
    
  } catch (error) {
    console.error('❌ 同步过程中出现错误:', error.message);
    console.error('📄 详细错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function checkCurrentStatus() {
  try {
    await prisma.$connect();
    
    // 检查practitioner_accounts表是否存在
    const practitionerAccountsExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'practitioner_accounts'
      ) as exists
    `;
    
    const exists = practitionerAccountsExists[0]?.exists;
    
    if (exists) {
      console.log('✅ practitioner_accounts表已存在于远端数据库');
      
      // 检查表结构
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'practitioner_accounts'
        ORDER BY ordinal_position
      `;
      
      console.log('📋 当前表结构:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
      
      return true;
    } else {
      console.log('❌ practitioner_accounts表不存在于远端数据库');
      return false;
    }
    
  } catch (error) {
    console.log('❌ 检查数据库状态失败:', error.message);
    return false;
  }
}

async function generateMigration() {
  try {
    console.log('🔧 生成practitioner_accounts迁移文件...');
    
    // 检查是否需要生成新的迁移
    const migrationName = 'add_practitioner_accounts_final';
    
    try {
      // 使用prisma migrate diff来检查差异
      console.log('🔍 检查Schema差异...');
      
      const diffOutput = execSync('npx prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      if (diffOutput.trim() === '') {
        console.log('✅ 数据库与Schema已同步，无需生成迁移');
        return false;
      } else {
        console.log('📄 发现Schema差异:');
        console.log(diffOutput);
      }
      
    } catch (diffError) {
      console.log('⚠️ 无法检查差异，继续生成迁移...');
    }
    
    // 生成迁移
    try {
      const output = execSync(`npx prisma migrate dev --name ${migrationName}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      console.log('✅ 迁移文件生成成功');
      console.log('📄 输出:', output);
      return true;
      
    } catch (migrateError) {
      // 如果migrate dev失败，尝试使用migrate deploy
      console.log('⚠️ migrate dev失败，尝试其他方法...');
      console.log('错误:', migrateError.message);
      return false;
    }
    
  } catch (error) {
    console.log('❌ 生成迁移失败:', error.message);
    return false;
  }
}

async function deployMigration() {
  try {
    console.log('🚀 部署迁移到远端数据库...');
    
    // 使用prisma migrate deploy来应用迁移
    const output = execSync('npx prisma migrate deploy', {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    console.log('✅ 迁移部署成功');
    console.log('📄 输出:', output);
    
  } catch (error) {
    console.log('❌ 部署迁移失败:', error.message);
    console.log('📄 错误输出:', error.stdout || error.stderr);
    
    // 尝试手动创建表
    console.log('🔧 尝试手动创建practitioner_accounts表...');
    await createPractitionerAccountsTableManually();
  }
}

async function createPractitionerAccountsTableManually() {
  try {
    console.log('🛠️ 手动创建practitioner_accounts表...');
    
    // 创建表的SQL
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "practitioner_accounts" (
        "id" TEXT NOT NULL,
        "practitioner_id" TEXT NOT NULL,
        "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
        "credit_limit" DECIMAL(12,2) NOT NULL DEFAULT 0,
        "used_credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
        "available_credit" DECIMAL(12,2),
        "status" TEXT NOT NULL DEFAULT 'active',
        "version" INTEGER NOT NULL DEFAULT 1,
        "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "practitioner_accounts_pkey" PRIMARY KEY ("id")
      )
    `;
    
    // 创建唯一索引
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "practitioner_accounts_practitioner_id_key" 
      ON "practitioner_accounts"("practitioner_id")
    `;
    
    // 创建状态索引
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "practitioner_accounts_status_idx" 
      ON "practitioner_accounts"("status")
    `;
    
    // 添加外键约束
    await prisma.$executeRaw`
      ALTER TABLE "practitioner_accounts" 
      ADD CONSTRAINT "practitioner_accounts_practitioner_id_fkey" 
      FOREIGN KEY ("practitioner_id") REFERENCES "users"("id") 
      ON DELETE RESTRICT ON UPDATE CASCADE
    `;
    
    console.log('✅ practitioner_accounts表创建成功');
    
    // 更新account_transactions表的外键（如果需要）
    await updateAccountTransactionsForeignKey();
    
  } catch (error) {
    console.log('❌ 手动创建表失败:', error.message);
  }
}

async function updateAccountTransactionsForeignKey() {
  try {
    console.log('🔗 更新account_transactions表的外键关系...');
    
    // 检查当前外键
    const currentForeignKeys = await prisma.$queryRaw`
      SELECT constraint_name
      FROM information_schema.table_constraints 
      WHERE table_name = 'account_transactions' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%account_id%'
    `;
    
    // 如果存在指向clinic_accounts的外键，先删除
    for (const fk of currentForeignKeys) {
      try {
        await prisma.$executeRaw`
          ALTER TABLE "account_transactions" 
          DROP CONSTRAINT IF EXISTS ${fk.constraint_name}
        `;
        console.log(`✅ 删除旧外键: ${fk.constraint_name}`);
      } catch (error) {
        console.log(`⚠️ 删除外键失败: ${fk.constraint_name}`);
      }
    }
    
    // 添加新的外键指向practitioner_accounts
    await prisma.$executeRaw`
      ALTER TABLE "account_transactions" 
      ADD CONSTRAINT "account_transactions_account_id_fkey" 
      FOREIGN KEY ("account_id") REFERENCES "practitioner_accounts"("id") 
      ON DELETE RESTRICT ON UPDATE CASCADE
    `;
    
    console.log('✅ 外键关系更新完成');
    
  } catch (error) {
    console.log('⚠️ 更新外键关系时出现问题:', error.message);
  }
}

async function verifyMigration() {
  try {
    await prisma.$connect();
    
    // 验证表存在
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'practitioner_accounts'
      ) as exists
    `;
    
    if (tableExists[0]?.exists) {
      console.log('✅ practitioner_accounts表验证成功');
      
      // 验证表结构
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'practitioner_accounts'
        ORDER BY ordinal_position
      `;
      
      console.log('📋 最终表结构:');
      columns.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`  - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
      });
      
      // 验证外键关系
      const foreignKeys = await prisma.$queryRaw`
        SELECT 
          tc.constraint_name,
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
          AND tc.table_name = 'practitioner_accounts'
      `;
      
      console.log('🔗 外键关系:');
      foreignKeys.forEach(fk => {
        console.log(`  - ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
      
      return true;
    } else {
      console.log('❌ practitioner_accounts表验证失败');
      return false;
    }
    
  } catch (error) {
    console.log('❌ 验证迁移失败:', error.message);
    return false;
  }
}

// 执行同步
syncPractitionerAccounts().catch(console.error);