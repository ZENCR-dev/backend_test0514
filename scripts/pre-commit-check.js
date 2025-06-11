#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');

/**
 * TCM处方平台 - 本地代码提交前自检脚本
 * 
 * 此脚本确保代码在推送到GitHub之前通过所有关键检查
 * 遵循项目的CI/CD规范和代码质量标准
 */

class PreCommitChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.steps = [
      { name: '依赖检查', fn: this.checkDependencies },
      { name: 'ESLint代码检查', fn: this.runLinting },
      { name: 'TypeScript类型检查', fn: this.runTypeCheck },
      { name: 'Prettier格式检查', fn: this.runPrettierCheck },
      { name: 'Prisma Schema验证', fn: this.validatePrismaSchema },
      { name: '单元测试', fn: this.runTests },
      { name: '测试覆盖率检查', fn: this.checkTestCoverage },
      { name: '构建检查', fn: this.runBuild },
      { name: '安全审计', fn: this.runSecurityAudit }
    ];
  }

  log(message, type = 'info') {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      header: chalk.cyan.bold
    };
    console.log(colors[type](message));
  }

  logStep(stepName, status) {
    const statusColor = status === 'success' ? chalk.green('✅') : 
                       status === 'warning' ? chalk.yellow('⚠️') : 
                       chalk.red('❌');
    console.log(`${statusColor} ${stepName}`);
  }

  exec(command, options = {}) {
    try {
      return execSync(command, { 
        stdio: options.silent ? 'pipe' : 'inherit',
        encoding: 'utf8',
        ...options 
      });
    } catch (error) {
      if (!options.silent) {
        console.error(chalk.red(`命令执行失败: ${command}`));
        console.error(error.message);
      }
      throw error;
    }
  }

  async checkDependencies() {
    try {
      // 检查package.json和package-lock.json是否同步
      const packageExists = require('fs').existsSync('./package.json');
      const lockExists = require('fs').existsSync('./package-lock.json');
      
      if (!packageExists) {
        throw new Error('package.json文件不存在');
      }
      
      if (!lockExists) {
        this.warnings.push('package-lock.json不存在，建议运行npm install');
      }

      // 检查node_modules是否存在
      const nodeModulesExists = require('fs').existsSync('./node_modules');
      if (!nodeModulesExists) {
        this.log('正在安装依赖...', 'info');
        this.exec('npm ci');
      }

      this.logStep('依赖检查', 'success');
    } catch (error) {
      this.errors.push(`依赖检查失败: ${error.message}`);
      this.logStep('依赖检查', 'error');
    }
  }

  async runLinting() {
    try {
      this.log('运行ESLint检查...', 'info');
      this.exec('npm run lint', { silent: true });
      this.logStep('ESLint代码检查', 'success');
    } catch (error) {
      this.errors.push('ESLint检查失败，请修复所有错误后重试');
      this.logStep('ESLint代码检查', 'error');
      // 显示ESLint错误详情
      try {
        this.exec('npm run lint');
      } catch (e) {
        // 错误已显示
      }
    }
  }

  async runTypeCheck() {
    try {
      this.log('运行TypeScript类型检查...', 'info');
      this.exec('npx tsc --noEmit', { silent: true });
      this.logStep('TypeScript类型检查', 'success');
    } catch (error) {
      this.errors.push('TypeScript类型检查失败');
      this.logStep('TypeScript类型检查', 'error');
      // 显示类型错误详情
      try {
        this.exec('npx tsc --noEmit');
      } catch (e) {
        // 错误已显示
      }
    }
  }

  async runPrettierCheck() {
    try {
      this.log('运行Prettier格式检查...', 'info');
      this.exec('npx prettier --check "src/**/*.{ts,js,json}"', { silent: true });
      this.logStep('Prettier格式检查', 'success');
    } catch (error) {
      this.warnings.push('代码格式不符合规范，建议运行 npm run format 修复');
      this.logStep('Prettier格式检查', 'warning');
    }
  }

  async validatePrismaSchema() {
    try {
      this.log('验证Prisma Schema...', 'info');
      this.exec('npx prisma validate', { silent: true });
      this.logStep('Prisma Schema验证', 'success');
    } catch (error) {
      this.errors.push('Prisma Schema验证失败');
      this.logStep('Prisma Schema验证', 'error');
    }
  }

  async runTests() {
    try {
      this.log('运行单元测试...', 'info');
      this.exec('npm test', { silent: true });
      this.logStep('单元测试', 'success');
    } catch (error) {
      this.errors.push('单元测试失败');
      this.logStep('单元测试', 'error');
      // 显示测试失败详情
      try {
        this.exec('npm test');
      } catch (e) {
        // 错误已显示
      }
    }
  }

  async checkTestCoverage() {
    try {
      this.log('检查测试覆盖率...', 'info');
      const coverage = this.exec('npm run test:cov', { silent: true });
      
      // 解析覆盖率报告
      if (coverage.includes('All files')) {
        const lines = coverage.split('\n');
        const summaryLine = lines.find(line => line.includes('All files'));
        if (summaryLine) {
          const match = summaryLine.match(/(\d+\.?\d*)%/);
          if (match) {
            const coveragePercent = parseFloat(match[1]);
            if (coveragePercent < 80) {
              this.warnings.push(`测试覆盖率较低: ${coveragePercent}%，建议达到80%以上`);
              this.logStep('测试覆盖率检查', 'warning');
            } else {
              this.logStep('测试覆盖率检查', 'success');
            }
          }
        }
      } else {
        this.logStep('测试覆盖率检查', 'success');
      }
    } catch (error) {
      this.warnings.push('测试覆盖率检查失败');
      this.logStep('测试覆盖率检查', 'warning');
    }
  }

  async runBuild() {
    try {
      this.log('运行构建检查...', 'info');
      
      // 先生成Prisma Client
      this.exec('npx prisma generate', { silent: true });
      
      // 然后构建项目
      this.exec('npm run build', { silent: true });
      
      // 检查dist目录是否存在
      const fs = require('fs');
      if (!fs.existsSync('./dist')) {
        throw new Error('构建产物不存在');
      }
      
      this.logStep('构建检查', 'success');
    } catch (error) {
      this.errors.push('构建失败');
      this.logStep('构建检查', 'error');
      // 显示构建错误详情
      try {
        this.exec('npm run build');
      } catch (e) {
        // 错误已显示
      }
    }
  }

  async runSecurityAudit() {
    try {
      this.log('运行安全审计...', 'info');
      this.exec('npm audit --audit-level=moderate', { silent: true });
      this.logStep('安全审计', 'success');
    } catch (error) {
      this.warnings.push('发现安全漏洞，建议运行 npm audit fix 修复');
      this.logStep('安全审计', 'warning');
    }
  }

  async run() {
    console.log(chalk.cyan.bold('\n🚀 TCM处方平台 - 代码提交前自检\n'));
    console.log(chalk.gray('确保代码质量，减少CI失败次数\n'));

    const startTime = Date.now();

    for (const step of this.steps) {
      await step.fn.call(this);
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    this.printSummary(duration);
    this.exitWithCode();
  }

  printSummary(duration) {
    console.log(chalk.cyan.bold('\n📊 自检结果汇总'));
    console.log(chalk.gray(`⏱️ 总耗时: ${duration}秒\n`));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log(chalk.green.bold('🎉 所有检查通过！代码可以提交。\n'));
      console.log(chalk.cyan('下一步操作:'));
      console.log(chalk.white('  git add .'));
      console.log(chalk.white('  git commit -m "feat: your commit message"'));
      console.log(chalk.white('  git push\n'));
    } else {
      if (this.errors.length > 0) {
        console.log(chalk.red.bold(`❌ 发现 ${this.errors.length} 个错误:`));
        this.errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
        console.log();
      }

      if (this.warnings.length > 0) {
        console.log(chalk.yellow.bold(`⚠️ 发现 ${this.warnings.length} 个警告:`));
        this.warnings.forEach(warning => console.log(chalk.yellow(`  • ${warning}`)));
        console.log();
      }

      if (this.errors.length > 0) {
        console.log(chalk.red.bold('🚫 请修复所有错误后重新运行检查。\n'));
      } else {
        console.log(chalk.yellow.bold('⚠️ 存在警告但可以提交，建议先修复警告。\n'));
      }
    }
  }

  exitWithCode() {
    process.exit(this.errors.length > 0 ? 1 : 0);
  }
}

// 运行自检
const checker = new PreCommitChecker();
checker.run().catch(error => {
  console.error(chalk.red('自检过程发生意外错误:'), error);
  process.exit(1);
}); 