import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

async function generateMigration() {
  try {
    console.log('🔧 Generating migration for PractitionerAccount...');
    
    // First, check current schema status
    console.log('📋 Current Prisma schema status:');
    
    // Generate migration
    const migrationName = 'add_practitioner_accounts';
    const command = `npx prisma migrate dev --name ${migrationName}`;
    
    console.log(`🚀 Running: ${command}`);
    
    try {
      const output = execSync(command, { 
        encoding: 'utf8',
        stdio: 'pipe',
        cwd: process.cwd()
      });
      
      console.log('✅ Migration generated successfully');
      console.log('📄 Output:', output);
      
      // Find the latest migration file
      const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
      const migrationDirs = execSync('ls -la prisma/migrations/', { encoding: 'utf8' });
      console.log('📁 Migration directories:', migrationDirs);
      
    } catch (execError: any) {
      console.error('❌ Migration generation failed:', execError.message);
      console.error('📄 Error output:', execError.stdout || execError.stderr);
    }
    
  } catch (error) {
    console.error('❌ Error in migration process:', error);
  }
}

generateMigration().catch(console.error);