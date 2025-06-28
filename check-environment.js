// Environment and database check script
const fs = require('fs');
const path = require('path');

console.log('='.repeat(50));
console.log('ENVIRONMENT CHECK REPORT');
console.log('='.repeat(50));

// Check Node.js version
console.log('Node.js version:', process.version);

// Check if we're in the right directory
console.log('Current directory:', process.cwd());

// Check if package.json exists
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  console.log('✅ package.json found');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log('Project name:', packageJson.name);
    console.log('Project version:', packageJson.version);
  } catch (error) {
    console.log('❌ Error reading package.json:', error.message);
  }
} else {
  console.log('❌ package.json not found');
}

// Check if Prisma schema exists
const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
if (fs.existsSync(schemaPath)) {
  console.log('✅ Prisma schema found');
  
  try {
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const hasPractitionerAccount = schemaContent.includes('model PractitionerAccount');
    console.log('PractitionerAccount model in schema:', hasPractitionerAccount ? '✅ YES' : '❌ NO');
  } catch (error) {
    console.log('❌ Error reading schema:', error.message);
  }
} else {
  console.log('❌ Prisma schema not found');
}

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log('✅ .env file found');
  
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const hasDatabaseUrl = envContent.includes('DATABASE_URL');
    const hasSupabaseUrl = envContent.includes('SUPABASE_URL');
    console.log('DATABASE_URL configured:', hasDatabaseUrl ? '✅ YES' : '❌ NO');
    console.log('SUPABASE_URL configured:', hasSupabaseUrl ? '✅ YES' : '❌ NO');
  } catch (error) {
    console.log('❌ Error reading .env:', error.message);
  }
} else {
  console.log('❌ .env file not found');
}

// Check node_modules
const nodeModulesPath = path.join(process.cwd(), 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('✅ node_modules found');
  
  // Check for key dependencies
  const prismaPath = path.join(nodeModulesPath, '@prisma', 'client');
  const tsxPath = path.join(nodeModulesPath, '.bin', 'tsx.cmd');
  
  console.log('@prisma/client installed:', fs.existsSync(prismaPath) ? '✅ YES' : '❌ NO');
  console.log('tsx available:', fs.existsSync(tsxPath) ? '✅ YES' : '❌ NO');
} else {
  console.log('❌ node_modules not found');
}

console.log('='.repeat(50));
console.log('ENVIRONMENT CHECK COMPLETED');
console.log('='.repeat(50));

// Try to load Prisma client
console.log('\nTesting Prisma client import...');
try {
  const { PrismaClient } = require('@prisma/client');
  console.log('✅ Prisma client imported successfully');
  
  // Test basic instantiation
  const prisma = new PrismaClient();
  console.log('✅ Prisma client instantiated successfully');
  
  console.log('\nReady to test database connection!');
  console.log('Next step: Run database connection test');
  
} catch (error) {
  console.log('❌ Prisma client import failed:', error.message);
}