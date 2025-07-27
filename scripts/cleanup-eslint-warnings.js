#!/usr/bin/env node

/**
 * ESLint Warnings Cleanup Script
 * 
 * Systematically removes unused imports and variables identified by ESLint
 * Preserves code functionality while improving code quality
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ESLINT_COMMAND = 'npx eslint "{src,apps,libs,test}/**/*.ts" --format json';

// Get ESLint results
function getESLintResults() {
  try {
    const output = execSync(ESLINT_COMMAND, { encoding: 'utf-8', stdio: 'pipe' });
    return JSON.parse(output);
  } catch (error) {
    // ESLint returns non-zero exit code when there are linting issues
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout);
      } catch (parseError) {
        console.error('Failed to parse ESLint output:', parseError);
        return [];
      }
    }
    console.error('ESLint execution failed:', error.message);
    return [];
  }
}

// Remove unused import from line
function removeUnusedImport(line, unusedVar) {
  // Handle single import: import { UnusedVar } from 'module'
  const singleImportPattern = new RegExp(`import\\s*{\\s*${unusedVar}\\s*}\\s*from`, 'g');
  if (singleImportPattern.test(line)) {
    return null; // Remove entire line
  }

  // Handle multiple imports: import { Used, UnusedVar, Used2 } from 'module'
  const multipleImportPattern = new RegExp(`import\\s*{([^}]+)}\\s*from`, 'g');
  const match = multipleImportPattern.exec(line);
  if (match) {
    const imports = match[1].split(',').map(imp => imp.trim()).filter(imp => imp !== unusedVar);
    if (imports.length === 0) {
      return null; // Remove entire line if no imports left
    }
    return line.replace(match[1], ` ${imports.join(', ')} `);
  }

  return line;
}

// Fix a file based on ESLint messages
function fixFile(filePath, messages) {
  if (messages.length === 0) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Sort messages by line number in descending order to avoid line number shifts
  const sortedMessages = messages
    .filter(msg => msg.ruleId === '@typescript-eslint/no-unused-vars')
    .sort((a, b) => b.line - a.line);

  let modified = false;

  for (const message of sortedMessages) {
    const lineIndex = message.line - 1;
    const line = lines[lineIndex];
    
    if (!line) continue;

    // Extract unused variable name from message
    const match = message.message.match(/'([^']+)' is defined but never used/);
    if (!match) continue;
    
    const unusedVar = match[1];
    
    // Check if it's an import line
    if (line.includes('import') && line.includes(unusedVar)) {
      const newLine = removeUnusedImport(line, unusedVar);
      if (newLine === null) {
        // Remove entire line
        lines.splice(lineIndex, 1);
      } else if (newLine !== line) {
        lines[lineIndex] = newLine;
      }
      modified = true;
    }
    // Handle unused variables (but be more careful not to break functionality)
    else if (line.includes(`const ${unusedVar}`) || line.includes(`let ${unusedVar}`) || line.includes(`var ${unusedVar}`)) {
      // Only remove simple unused variable declarations
      if (line.trim().startsWith('const ') || line.trim().startsWith('let ') || line.trim().startsWith('var ')) {
        lines.splice(lineIndex, 1);
        modified = true;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Fixed ${sortedMessages.length} issues in ${filePath}`);
  }
}

// Main execution
function main() {
  console.log('🧹 Starting ESLint warnings cleanup...');
  
  const results = getESLintResults();
  
  if (!Array.isArray(results)) {
    console.error('❌ Invalid ESLint results');
    return;
  }

  let totalFilesFixed = 0;
  let totalIssuesFixed = 0;

  for (const result of results) {
    if (result.messages && result.messages.length > 0) {
      const unusedVarMessages = result.messages.filter(msg => 
        msg.ruleId === '@typescript-eslint/no-unused-vars'
      );
      
      if (unusedVarMessages.length > 0) {
        fixFile(result.filePath, unusedVarMessages);
        totalFilesFixed++;
        totalIssuesFixed += unusedVarMessages.length;
      }
    }
  }

  console.log(`\n✅ Cleanup completed:`);
  console.log(`   📁 Files fixed: ${totalFilesFixed}`);
  console.log(`   🔧 Issues fixed: ${totalIssuesFixed}`);
  
  // Run ESLint again to verify improvements
  console.log('\n🔍 Verifying improvements...');
  try {
    execSync('npm run lint', { stdio: 'inherit' });
  } catch (error) {
    console.log('Some warnings may still remain - manual review recommended');
  }
}

if (require.main === module) {
  main();
}

module.exports = { getESLintResults, removeUnusedImport, fixFile };