import { PrismaClient } from '@prisma/client';

async function checkMigrationStatus() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking database migration status...');
    
    // Test connection
    await prisma.$connect();
    console.log('✅ Connected to Supabase database');
    
    // Check if practitioner_accounts table exists
    const tableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'practitioner_accounts'
      ) as table_exists
    `;
    
    const tableExists = (tableCheck as any)[0]?.table_exists;
    
    if (tableExists) {
      console.log('✅ practitioner_accounts table EXISTS in database');
      
      // Get table structure
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'practitioner_accounts'
        ORDER BY ordinal_position
      `;
      
      console.log('\n📋 Table structure:');
      (columns as any[]).forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
      
    } else {
      console.log('❌ practitioner_accounts table does NOT exist');
      console.log('🔧 Migration needed to create the table');
    }
    
    // Check current migration status
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations 
      ORDER BY finished_at DESC 
      LIMIT 10
    `;
    
    console.log('\n📊 Migration history:');
    (migrations as any[]).forEach(migration => {
      const status = migration.rolled_back_at ? '❌ ROLLED BACK' : '✅ APPLIED';
      console.log(`  ${status} ${migration.migration_name}`);
    });
    
    // List all current tables
    const allTables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log('\n📋 All current tables:');
    (allTables as any[]).forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMigrationStatus().catch(console.error);