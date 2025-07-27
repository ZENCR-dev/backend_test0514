// Simple database verification script
require('dotenv').config();

const { Client } = require('pg');

async function verifyDatabase() {
  // Parse DATABASE_URL
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not found in environment');
    return;
  }
  
  console.log('🔍 Connecting to Supabase database...');
  console.log('🔗 Database URL:', dbUrl.replace(/:[^:]*@/, ':***@')); // Hide password
  
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Successfully connected to database');
    
    // Check if practitioner_accounts table exists
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'practitioner_accounts'
      ) as exists;
    `;
    
    const tableResult = await client.query(tableCheckQuery);
    const tableExists = tableResult.rows[0].exists;
    
    console.log(`📋 practitioner_accounts table exists: ${tableExists ? '✅ YES' : '❌ NO'}`);
    
    if (!tableExists) {
      console.log('🔧 Need to create practitioner_accounts table');
      
      // Show what tables currently exist
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;
      
      const tablesResult = await client.query(tablesQuery);
      console.log('\n📋 Current tables in database:');
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
      
      // Check migration table
      const migrationQuery = `
        SELECT migration_name, finished_at 
        FROM _prisma_migrations 
        ORDER BY finished_at DESC 
        LIMIT 5;
      `;
      
      try {
        const migrationResult = await client.query(migrationQuery);
        console.log('\n📊 Recent migrations:');
        migrationResult.rows.forEach(row => {
          console.log(`  - ${row.migration_name} (${row.finished_at})`);
        });
      } catch (migError) {
        console.log('⚠️ Could not read migration history:', migError.message);
      }
    } else {
      // Table exists, show its structure
      const structureQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'practitioner_accounts'
        ORDER BY ordinal_position;
      `;
      
      const structureResult = await client.query(structureQuery);
      console.log('\n📋 practitioner_accounts table structure:');
      structureResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Database connection or query failed:', error.message);
  } finally {
    await client.end();
  }
}

verifyDatabase();