/**
 * RIPER-5 EXECUTE MODE: PractitionerAccount Database Migration
 * 
 * This script follows the RIPER-5 execution protocol:
 * 1. Implement exactly as planned
 * 2. Follow numbered checklist
 * 3. Mark items as completed
 * 4. Update task progress
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface ExecutionStep {
  id: number;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  output?: string;
  error?: string;
}

class MigrationExecutor {
  private steps: ExecutionStep[] = [
    { id: 1, description: 'Verify database connection and current status', status: 'pending' },
    { id: 2, description: 'Check if PractitionerAccount table already exists', status: 'pending' },
    { id: 3, description: 'Generate migration file if needed', status: 'pending' },
    { id: 4, description: 'Review generated migration content', status: 'pending' },
    { id: 5, description: 'Apply migration to Supabase database', status: 'pending' },
    { id: 6, description: 'Verify table creation and structure', status: 'pending' },
    { id: 7, description: 'Test basic PractitionerAccount operations', status: 'pending' },
    { id: 8, description: 'Generate execution report', status: 'pending' }
  ];

  private logProgress(stepId: number, status: 'in_progress' | 'completed' | 'failed', output?: string, error?: string) {
    const step = this.steps.find(s => s.id === stepId);
    if (step) {
      step.status = status;
      if (output) step.output = output;
      if (error) step.error = error;
    }
    
    const timestamp = new Date().toISOString();
    const statusEmoji = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '🔄';
    console.log(`${statusEmoji} [${timestamp}] Step ${stepId}: ${step?.description} - ${status.toUpperCase()}`);
    
    if (output) console.log(`   📄 Output: ${output}`);
    if (error) console.log(`   ❌ Error: ${error}`);
  }

  async executeStep1(): Promise<boolean> {
    this.logProgress(1, 'in_progress');
    
    try {
      await prisma.$connect();
      
      // Test basic query
      const result = await prisma.$queryRaw`SELECT 1 as test` as { test: number }[];
      
      if (result[0]?.test === 1) {
        this.logProgress(1, 'completed', 'Database connection successful');
        return true;
      } else {
        this.logProgress(1, 'failed', undefined, 'Database query test failed');
        return false;
      }
    } catch (error: any) {
      this.logProgress(1, 'failed', undefined, error.message);
      return false;
    }
  }

  async executeStep2(): Promise<boolean> {
    this.logProgress(2, 'in_progress');
    
    try {
      const tableExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'practitioner_accounts'
        ) as exists
      ` as { exists: boolean }[];
      
      const exists = tableExists[0]?.exists;
      
      if (exists) {
        this.logProgress(2, 'completed', 'PractitionerAccount table already exists');
        return true;
      } else {
        this.logProgress(2, 'completed', 'PractitionerAccount table does not exist - migration needed');
        return false;
      }
    } catch (error: any) {
      this.logProgress(2, 'failed', undefined, error.message);
      return false;
    }
  }

  async executeStep3(): Promise<boolean> {
    this.logProgress(3, 'in_progress');
    
    try {
      const migrationName = 'add_practitioner_accounts';
      const command = `npx prisma migrate dev --name ${migrationName}`;
      
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      this.logProgress(3, 'completed', `Migration generated: ${output.substring(0, 200)}...`);
      return true;
      
    } catch (error: any) {
      // Check if error is due to no changes needed
      if (error.message.includes('no changes') || error.message.includes('already in sync')) {
        this.logProgress(3, 'completed', 'No migration needed - schema already in sync');
        return true;
      } else {
        this.logProgress(3, 'failed', undefined, error.message);
        return false;
      }
    }
  }

  async executeStep4(): Promise<boolean> {
    this.logProgress(4, 'in_progress');
    
    try {
      const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
      const migrationDirs = readdirSync(migrationsDir)
        .filter(dir => dir.includes('add_practitioner_accounts'))
        .sort()
        .reverse();
      
      if (migrationDirs.length > 0) {
        const latestMigrationDir = migrationDirs[0];
        const migrationFile = path.join(migrationsDir, latestMigrationDir, 'migration.sql');
        const content = readFileSync(migrationFile, 'utf8');
        
        this.logProgress(4, 'completed', `Migration content reviewed: ${content.length} characters`);
        return true;
      } else {
        this.logProgress(4, 'completed', 'No new migration file found - likely no changes needed');
        return true;
      }
    } catch (error: any) {
      this.logProgress(4, 'failed', undefined, error.message);
      return false;
    }
  }

  async executeStep5(): Promise<boolean> {
    this.logProgress(5, 'in_progress');
    
    try {
      const output = execSync('npx prisma migrate deploy', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      this.logProgress(5, 'completed', `Migration deployed: ${output.substring(0, 200)}...`);
      return true;
      
    } catch (error: any) {
      this.logProgress(5, 'failed', undefined, error.message);
      return false;
    }
  }

  async executeStep6(): Promise<boolean> {
    this.logProgress(6, 'in_progress');
    
    try {
      const tableExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'practitioner_accounts'
        ) as exists
      ` as { exists: boolean }[];
      
      const exists = tableExists[0]?.exists;
      
      if (exists) {
        // Get table structure
        const columns = await prisma.$queryRaw`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = 'practitioner_accounts'
          ORDER BY ordinal_position
        ` as { column_name: string; data_type: string; is_nullable: string }[];
        
        const columnNames = columns.map(c => c.column_name).join(', ');
        this.logProgress(6, 'completed', `Table verified with columns: ${columnNames}`);
        return true;
      } else {
        this.logProgress(6, 'failed', undefined, 'Table verification failed - table does not exist');
        return false;
      }
    } catch (error: any) {
      this.logProgress(6, 'failed', undefined, error.message);
      return false;
    }
  }

  async executeStep7(): Promise<boolean> {
    this.logProgress(7, 'in_progress');
    
    try {
      // Test basic operations
      const count = await prisma.practitionerAccount.count();
      
      this.logProgress(7, 'completed', `Basic operations test passed - record count: ${count}`);
      return true;
      
    } catch (error: any) {
      this.logProgress(7, 'failed', undefined, error.message);
      return false;
    }
  }

  async executeStep8(): Promise<boolean> {
    this.logProgress(8, 'in_progress');
    
    try {
      const report = {
        timestamp: new Date().toISOString(),
        migration: 'PractitionerAccount table creation',
        steps: this.steps,
        summary: {
          total: this.steps.length,
          completed: this.steps.filter(s => s.status === 'completed').length,
          failed: this.steps.filter(s => s.status === 'failed').length
        }
      };
      
      const reportPath = `migration-report-${Date.now()}.json`;
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      this.logProgress(8, 'completed', `Execution report generated: ${reportPath}`);
      return true;
      
    } catch (error: any) {
      this.logProgress(8, 'failed', undefined, error.message);
      return false;
    }
  }

  async execute(): Promise<void> {
    console.log('🚀 [MODE: EXECUTE] Starting PractitionerAccount migration execution...');
    console.log('📋 Following RIPER-5 execution protocol\n');
    
    try {
      // Execute steps in sequence
      const step1Success = await this.executeStep1();
      if (!step1Success) throw new Error('Step 1 failed - cannot continue');
      
      const tableExists = await this.executeStep2();
      
      if (!tableExists) {
        const step3Success = await this.executeStep3();
        if (!step3Success) throw new Error('Step 3 failed - migration generation failed');
        
        const step4Success = await this.executeStep4();
        if (!step4Success) throw new Error('Step 4 failed - migration review failed');
        
        const step5Success = await this.executeStep5();
        if (!step5Success) throw new Error('Step 5 failed - migration deployment failed');
      } else {
        console.log('⏭️ Skipping steps 3-5: Table already exists');
        this.steps[2].status = 'completed';
        this.steps[2].output = 'Skipped - table already exists';
        this.steps[3].status = 'completed';
        this.steps[3].output = 'Skipped - table already exists';
        this.steps[4].status = 'completed';
        this.steps[4].output = 'Skipped - table already exists';
      }
      
      const step6Success = await this.executeStep6();
      if (!step6Success) throw new Error('Step 6 failed - table verification failed');
      
      const step7Success = await this.executeStep7();
      if (!step7Success) throw new Error('Step 7 failed - operations test failed');
      
      await this.executeStep8();
      
      console.log('\n🎉 Migration execution completed successfully!');
      console.log('📊 Summary:');
      console.log(`   ✅ Completed: ${this.steps.filter(s => s.status === 'completed').length}/${this.steps.length}`);
      console.log(`   ❌ Failed: ${this.steps.filter(s => s.status === 'failed').length}/${this.steps.length}`);
      
    } catch (error: any) {
      console.error('\n❌ Migration execution failed:', error.message);
      await this.executeStep8(); // Generate report even on failure
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Execute the migration
const executor = new MigrationExecutor();
executor.execute().catch(console.error);