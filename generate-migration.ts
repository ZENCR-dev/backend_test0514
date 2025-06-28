import { execSync } from 'child_process';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

async function generatePractitionerAccountMigration() {
  try {
    console.log('🔧 Generating migration for PractitionerAccount table...');
    
    // Check current migration status first
    console.log('\n📋 Current migration status:');
    try {
      const statusOutput = execSync('npx prisma migrate status', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.log(statusOutput);
    } catch (statusError: any) {
      console.log('⚠️ Could not check migration status:', statusError.message);
    }
    
    // Generate the migration
    const migrationName = 'add_practitioner_accounts';
    console.log(`\n🚀 Generating migration: ${migrationName}`);
    
    try {
      const migrationOutput = execSync(`npx prisma migrate dev --name ${migrationName}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      console.log('✅ Migration generated successfully!');
      console.log('📄 Output:', migrationOutput);
      
      // Find and display the generated migration file
      const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
      const migrationDirs = readdirSync(migrationsDir)
        .filter(dir => dir.includes(migrationName))
        .sort()
        .reverse();
      
      if (migrationDirs.length > 0) {
        const latestMigrationDir = migrationDirs[0];
        const migrationFile = path.join(migrationsDir, latestMigrationDir, 'migration.sql');
        
        console.log(`\n📁 Generated migration file: ${latestMigrationDir}/migration.sql`);
        
        try {
          const migrationContent = readFileSync(migrationFile, 'utf8');
          console.log('\n📄 Migration content:');
          console.log('─'.repeat(50));
          console.log(migrationContent);
          console.log('─'.repeat(50));
        } catch (readError) {
          console.log('⚠️ Could not read migration file content');
        }
      }
      
    } catch (migrationError: any) {
      console.error('❌ Migration generation failed:', migrationError.message);
      
      if (migrationError.stdout) {
        console.log('📄 stdout:', migrationError.stdout);
      }
      if (migrationError.stderr) {
        console.log('📄 stderr:', migrationError.stderr);
      }
      
      // Check if it's because the migration already exists
      if (migrationError.message.includes('already exists') || 
          migrationError.message.includes('no changes')) {
        console.log('\n💡 This might mean:');
        console.log('  1. The table already exists in the database');
        console.log('  2. The schema is already in sync');
        console.log('  3. A migration with this name already exists');
        
        console.log('\n🔍 Let\'s check what migrations exist:');
        try {
          const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
          const existingMigrations = readdirSync(migrationsDir);
          console.log('📁 Existing migrations:');
          existingMigrations.forEach(migration => {
            console.log(`  - ${migration}`);
          });
        } catch (listError) {
          console.log('⚠️ Could not list existing migrations');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

generatePractitionerAccountMigration().catch(console.error);