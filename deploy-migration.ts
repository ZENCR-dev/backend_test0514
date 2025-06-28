import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deployMigration() {
  try {
    console.log('🚀 Deploying migration to Supabase production database...');
    
    // First, verify database connection
    console.log('\n🔍 Verifying database connection...');
    await prisma.$connect();
    console.log('✅ Connected to Supabase database');
    
    // Check current migration status
    console.log('\n📋 Checking current migration status...');
    try {
      const statusOutput = execSync('npx prisma migrate status', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.log(statusOutput);
    } catch (statusError: any) {
      console.log('⚠️ Migration status check failed:', statusError.message);
    }
    
    // Deploy migrations
    console.log('\n🚀 Deploying migrations...');
    try {
      const deployOutput = execSync('npx prisma migrate deploy', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      console.log('✅ Migration deployed successfully!');
      console.log('📄 Output:', deployOutput);
      
    } catch (deployError: any) {
      console.error('❌ Migration deployment failed:', deployError.message);
      
      if (deployError.stdout) {
        console.log('📄 stdout:', deployError.stdout);
      }
      if (deployError.stderr) {
        console.log('📄 stderr:', deployError.stderr);
      }
      
      return;
    }
    
    // Verify the table was created
    console.log('\n🔍 Verifying table creation...');
    
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'practitioner_accounts'
      ) as exists
    ` as { exists: boolean }[];
    
    const exists = tableExists[0]?.exists;
    
    if (exists) {
      console.log('✅ practitioner_accounts table created successfully!');
      
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
      
      // Test basic operations
      console.log('\n🧪 Testing basic table operations...');
      
      try {
        // Test count (should be 0 for new table)
        const count = await prisma.practitionerAccount.count();
        console.log(`✅ Table accessible - current record count: ${count}`);
        
        console.log('\n🎉 Migration completed successfully!');
        console.log('📋 Next steps:');
        console.log('  1. Test PractitionerAccount service functionality');
        console.log('  2. Run integration tests');
        console.log('  3. Verify API endpoints work correctly');
        
      } catch (testError) {
        console.log('⚠️ Table created but basic operations failed:', testError);
      }
      
    } else {
      console.log('❌ Table creation verification failed');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deployMigration().catch(console.error);