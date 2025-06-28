// Simple database connection test
const { PrismaClient } = require('@prisma/client');

async function testDatabaseConnection() {
  const prisma = new PrismaClient();
  
  console.log('🔍 Testing Supabase database connection...');
  
  try {
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test basic query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Basic query successful:', result);
    
    // Check if practitioner_accounts table exists
    const tableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'practitioner_accounts'
      ) as exists
    `;
    
    const tableExists = tableCheck[0]?.exists;
    console.log('📋 practitioner_accounts table exists:', tableExists ? '✅ YES' : '❌ NO');
    
    if (!tableExists) {
      console.log('\n🔧 MIGRATION NEEDED');
      console.log('The PractitionerAccount table needs to be created in the database.');
      console.log('Current schema has the model defined but database table is missing.');
      
      // Show current tables
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;
      
      console.log('\n📋 Current database tables:');
      tables.forEach((table, index) => {
        console.log(`  ${index + 1}. ${table.table_name}`);
      });
      
      console.log('\n🚀 Recommended actions:');
      console.log('1. Generate migration: npx prisma migrate dev --name add_practitioner_accounts');
      console.log('2. Or run our custom script: node execute-practitioner-migration.js');
      
    } else {
      console.log('\n✅ DATABASE IS READY');
      console.log('PractitionerAccount table exists in the database.');
      
      // Test basic operations
      const count = await prisma.practitionerAccount.count();
      console.log(`📊 Current practitioner accounts: ${count}`);
    }
    
  } catch (error) {
    console.log('❌ Database test failed:', error.message);
    
    if (error.message.includes('connect')) {
      console.log('\n🔧 Connection troubleshooting:');
      console.log('1. Check if DATABASE_URL is correct in .env file');
      console.log('2. Verify Supabase project is running');
      console.log('3. Check network connectivity');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDatabaseConnection().catch(console.error);