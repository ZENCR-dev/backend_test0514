const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Check if practitioner_accounts table exists
    try {
      const result = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'practitioner_accounts'
      `;
      
      if (result.length > 0) {
        console.log('✅ practitioner_accounts table exists');
      } else {
        console.log('❌ practitioner_accounts table does NOT exist');
      }
    } catch (error) {
      console.log('❌ Error checking practitioner_accounts table:', error.message);
    }
    
    // List all tables
    try {
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;
      
      console.log('\n📋 Current database tables:');
      tables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
    } catch (error) {
      console.log('❌ Error listing tables:', error.message);
    }
    
    // Check migration status
    try {
      const migrations = await prisma.$queryRaw`
        SELECT migration_name, finished_at 
        FROM _prisma_migrations 
        ORDER BY finished_at DESC 
        LIMIT 5
      `;
      
      console.log('\n📊 Recent migrations:');
      migrations.forEach(migration => {
        console.log(`  - ${migration.migration_name} (${migration.finished_at})`);
      });
    } catch (error) {
      console.log('❌ Error checking migrations:', error.message);
    }
    
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();