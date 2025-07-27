#!/usr/bin/env node

/**
 * 本地CI自检脚本 - NestJS后端项目
 * 
 * 目的：在推送到远程仓库前，本地执行与GitHub Actions相同的核心检查
 * 使用：npm run ci-check 或 node scripts/local-ci-check.js
 */

const { execSync } = require('child_process');
const chalk = require('chalk');
const path = require('path');

class LocalCIChecker {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.warnings = [];
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    switch (type) {
      case 'success':
        console.log(chalk.green(`✅ [${timestamp}] ${message}`));
        break;
      case 'error':
        console.log(chalk.red(`❌ [${timestamp}] ${message}`));
        break;
      case 'warning':
        console.log(chalk.yellow(`⚠️  [${timestamp}] ${message}`));
        break;
      case 'info':
        console.log(chalk.blue(`ℹ️  [${timestamp}] ${message}`));
        break;
      case 'step':
        console.log(chalk.cyan(`\n🔍 [${timestamp}] ${message}`));
        break;
    }
  }

  async executeCommand(command, description, options = {}) {
    const { critical = true, showOutput = false } = options;
    
    try {
      this.log(`执行: ${command}`, 'step');
      
      const result = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: showOutput ? 'inherit' : 'pipe'
      });

      this.log(`${description} - 通过`, 'success');
      this.passed++;
      
      return { success: true, output: result };
    } catch (error) {
      if (critical) {
        this.log(`${description} - 失败`, 'error');
        this.log(`错误信息: ${error.message}`, 'error');
        this.failed++;
        return { success: false, error: error.message };
      } else {
        this.log(`${description} - 警告`, 'warning');
        this.warnings.push(`${description}: ${error.message}`);
        return { success: false, error: error.message, warning: true };
      }
    }
  }

  async checkDependencies() {
    this.log('检查项目依赖安装状态...', 'step');
    
    // 检查node_modules是否存在
    const fs = require('fs');
    if (fs.existsSync('node_modules')) {
      this.log('依赖已安装', 'success');
    } else {
      this.log('依赖未安装，正在安装...', 'info');
      await this.executeCommand('npm ci', '安装项目依赖', { showOutput: true });
    }
  }

  async runCodeQualityChecks() {
    this.log('\n==================== 代码质量检查 ====================', 'info');
    
    // 1. ESLint检查
    await this.executeCommand(
      'npm run lint:check', 
      'ESLint代码风格检查'
    );

    // 2. TypeScript类型检查
    await this.executeCommand(
      'npx tsc --noEmit', 
      'TypeScript类型检查'
    );

    // 3. Prettier格式检查
    await this.executeCommand(
      'npx prettier --check "src/**/*.{ts,js,json}"', 
      'Prettier代码格式检查'
    );

    // 4. Prisma schema验证
    await this.executeCommand(
      'npx prisma validate', 
      'Prisma数据库schema验证'
    );
  }

  async runTests() {
    this.log('\n==================== 测试检查 ====================', 'info');
    
    // 1. Prisma客户端生成
    await this.executeCommand(
      'npx prisma generate', 
      'Prisma客户端生成'
    );

    // 2. 单元测试
    await this.executeCommand(
      'npm test', 
      '单元测试执行',
      { showOutput: true }
    );

    // 3. 测试覆盖率
    await this.executeCommand(
      'npm run test:cov', 
      '测试覆盖率检查'
    );
  }

  async runBuildCheck() {
    this.log('\n==================== 构建检查 ====================', 'info');
    
    // 应用构建
    await this.executeCommand(
      'npm run build', 
      '应用构建检查',
      { showOutput: true }
    );

    // 检查构建产物
    try {
      const fs = require('fs');
      if (fs.existsSync('dist')) {
        this.log('构建产物验证 - 通过', 'success');
        this.passed++;
      } else {
        this.log('构建产物验证 - 失败：dist目录不存在', 'error');
        this.failed++;
      }
    } catch {
      this.log('构建产物验证 - 失败：dist目录不存在', 'error');
      this.failed++;
    }
  }

  async runSecurityChecks() {
    this.log('\n==================== 安全检查 ====================', 'info');
    
    // 依赖安全审计
    await this.executeCommand(
      'npm audit --audit-level=moderate', 
      '依赖安全审计',
      { critical: false }
    );

    // 检查过时依赖
    await this.executeCommand(
      'npm outdated', 
      '依赖版本检查',
      { critical: false }
    );
  }

  printSummary() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log(chalk.bold.cyan('           本地CI自检结果总结'));
    console.log('='.repeat(60));
    
    console.log(`⏱️  执行时间: ${duration}秒`);
    console.log(`✅ 通过检查: ${chalk.green(this.passed)}`);
    console.log(`❌ 失败检查: ${chalk.red(this.failed)}`);
    console.log(`⚠️  警告数量: ${chalk.yellow(this.warnings.length)}`);
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  警告详情:');
      this.warnings.forEach(warning => {
        console.log(chalk.yellow(`   • ${warning}`));
      });
    }
    
    if (this.failed === 0) {
      console.log('\n' + chalk.green.bold('🎉 所有关键检查已通过！代码可以安全推送到远程仓库。'));
      console.log(chalk.green('✅ 执行: git add . && git commit -m "your message" && git push'));
      return true;
    } else {
      console.log('\n' + chalk.red.bold('❌ 检查失败！请修复上述问题后再推送代码。'));
      console.log(chalk.red('🚫 禁止推送到远程仓库，直到所有检查通过。'));
      return false;
    }
  }

  async runFullCheck() {
    console.log(chalk.bold.blue('\n🚀 开始执行本地CI自检流程...\n'));
    
    try {
      // 检查依赖
      await this.checkDependencies();
      
      // 代码质量检查
      await this.runCodeQualityChecks();
      
      // 测试检查
      await this.runTests();
      
      // 构建检查
      await this.runBuildCheck();
      
      // 安全检查
      await this.runSecurityChecks();
      
      // 打印总结
      const success = this.printSummary();
      
      // 退出码
      process.exit(success ? 0 : 1);
      
    } catch (error) {
      console.error(chalk.red(`\n💥 检查过程中发生未预期错误: ${error.message}`));
      process.exit(1);
    }
  }
}

// 主执行逻辑
if (require.main === module) {
  const checker = new LocalCIChecker();
  checker.runFullCheck();
}

module.exports = LocalCIChecker; 