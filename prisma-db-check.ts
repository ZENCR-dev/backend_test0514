import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabaseStatus() {
  try {
    console.log('🔍 Checking Supabase database status...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Successfully connected to Supabase database');
    
    // Check if practitioner_accounts table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'practitioner_accounts'
      ) as exists
    ` as { exists: boolean }[];
    
    const exists = tableExists[0]?.exists;
    console.log(`📋 practitioner_accounts table: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
    
    if (!exists) {
      console.log('\n🔧 Migration needed - PractitionerAccount table not found');
      
      // Show current tables
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      ` as { table_name: string }[];
      
      console.log('\n📋 Current tables in database:');
      tables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
      
      // Check migration history
      try {
        const migrations = await prisma.$queryRaw`
          SELECT migration_name, finished_at, rolled_back_at
          FROM _prisma_migrations 
          ORDER BY finished_at DESC 
          LIMIT 5
        ` as { migration_name: string; finished_at: Date; rolled_back_at: Date | null }[];
        
        console.log('\n📊 Recent migrations:');
        migrations.forEach(migration => {
          const status = migration.rolled_back_at ? '❌ ROLLED BACK' : '✅ APPLIED';
          console.log(`  ${status} ${migration.migration_name} (${migration.finished_at})`);
        });
      } catch (migError) {
        console.log('⚠️ Could not read migration history');
      }
      
      console.log('\n🚀 Next steps:');
      console.log('  1. Generate migration: npx prisma migrate dev --name add_practitioner_accounts');
      console.log('  2. Apply to production: npx prisma migrate deploy');
      
    } else {
      console.log('✅ PractitionerAccount table exists - checking structure...');
      
      // Get table structure
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'practitioner_accounts'
        ORDER BY ordinal_position
      ` as { column_name: string; data_type: string; is_nullable: string; column_default: string | null }[];
      
      console.log('\n📋 Table structure:');
      columns.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`  - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseStatus().catch(console.error);