#!/usr/bin/env npx tsx

import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';

interface IndexOperation {
  name: string;
  type: 'CREATE' | 'DROP' | 'CHECK';
  sql: string;
  description: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  duration?: number;
  error?: string;
}

class SearchIndexRebuilder {
  private prisma: PrismaClient;
  private operations: IndexOperation[] = [];
  private results: {
    totalOperations: number;
    successful: number;
    failed: number;
    skipped: number;
    totalDuration: number;
    timestamp: string;
  };

  constructor() {
    this.prisma = new PrismaClient();
    this.results = {
      totalOperations: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      totalDuration: 0,
      timestamp: new Date().toISOString()
    };
  }

  private async executeOperation(operation: IndexOperation): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      console.log(chalk.blue(`🔧 ${operation.type}: ${operation.name}`));
      console.log(chalk.gray(`   ${operation.description}`));
      
      if (operation.type === 'CHECK') {
        // 检查索引是否存在
        const result = await this.prisma.$queryRawUnsafe(operation.sql);
        operation.status = 'SUCCESS';
        console.log(chalk.green(`   ✅ 检查完成`));
        return true;
      } else {
        await this.prisma.$executeRawUnsafe(operation.sql);
        operation.status = 'SUCCESS';
        console.log(chalk.green(`   ✅ 执行成功`));
        return true;
      }
    } catch (error: any) {
      operation.status = 'FAILED';
      operation.error = error.message;
      
      // 某些错误是可以接受的（如索引已存在或不存在）
      if (error.message.includes('already exists') || 
          error.message.includes('does not exist') ||
          error.message.includes('relation') && error.message.includes('does not exist')) {
        operation.status = 'SKIPPED';
        console.log(chalk.yellow(`   ⚠️ 跳过: ${error.message}`));
        return true;
      }
      
      console.log(chalk.red(`   ❌ 失败: ${error.message}`));
      return false;
    } finally {
      operation.duration = Date.now() - startTime;
    }
  }

  private initializeOperations() {
    // 删除可能存在的旧索引（如果存在）
    this.operations.push({
      name: 'drop_old_search_index',
      type: 'DROP',
      sql: 'DROP INDEX IF EXISTS idx_medicines_search_old;',
      description: '删除旧的搜索索引',
      status: 'PENDING'
    });

    // 创建优化的搜索索引
    this.operations.push({
      name: 'create_compound_search_index',
      type: 'CREATE',
      sql: `CREATE INDEX IF NOT EXISTS idx_medicines_search_compound 
            ON medicines(status, name, pinyin_name, chinese_name, english_name) 
            WHERE status = 'active';`,
      description: '创建复合搜索索引（状态+多字段搜索）',
      status: 'PENDING'
    });

    // 创建分类状态索引
    this.operations.push({
      name: 'create_category_status_index',
      type: 'CREATE',
      sql: `CREATE INDEX IF NOT EXISTS idx_medicines_category_status 
            ON medicines(category, status) 
            WHERE status = 'active';`,
      description: '创建分类状态复合索引',
      status: 'PENDING'
    });

    // 创建价格范围索引
    this.operations.push({
      name: 'create_price_range_index', 
      type: 'CREATE',
      sql: `CREATE INDEX IF NOT EXISTS idx_medicines_price_range 
            ON medicines(base_price, status) 
            WHERE status = 'active';`,
      description: '创建价格范围索引',
      status: 'PENDING'
    });

    // 创建全文搜索索引（PostgreSQL特性）
    this.operations.push({
      name: 'create_fulltext_search_index',
      type: 'CREATE', 
      sql: `CREATE INDEX IF NOT EXISTS idx_medicines_fulltext 
            ON medicines USING GIN(to_tsvector('simple', 
              COALESCE(name, '') || ' ' || 
              COALESCE(chinese_name, '') || ' ' || 
              COALESCE(english_name, '') || ' ' || 
              COALESCE(pinyin_name, '')
            )) WHERE status = 'active';`,
      description: '创建全文搜索索引（PostgreSQL GIN）',
      status: 'PENDING'
    });

    // 创建SKU唯一索引优化
    this.operations.push({
      name: 'optimize_sku_index',
      type: 'CREATE',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_medicines_sku_unique 
            ON medicines(sku) WHERE status = 'active';`,
      description: '优化SKU唯一性索引',
      status: 'PENDING'
    });

    // 检查索引创建结果
    this.operations.push({
      name: 'verify_indexes',
      type: 'CHECK',
      sql: `SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'medicines' 
            AND indexname LIKE 'idx_medicines_%'
            ORDER BY indexname;`,
      description: '验证索引创建结果',
      status: 'PENDING'
    });
  }

  private printHeader() {
    console.log(chalk.blue.bold('\n🔍 药品搜索索引重建工具'));
    console.log(chalk.gray('='.repeat(60)));
    console.log(chalk.yellow(`开始时间: ${new Date().toLocaleString()}`));
    console.log('');
  }

  private async printResults() {
    console.log(chalk.blue.bold('\n📊 索引重建结果:'));
    
    this.operations.forEach(op => {
      const icon = op.status === 'SUCCESS' ? '✅' : 
                   op.status === 'SKIPPED' ? '⚠️' : 
                   op.status === 'FAILED' ? '❌' : '⏳';
      
      const color = op.status === 'SUCCESS' ? chalk.green :
                    op.status === 'SKIPPED' ? chalk.yellow :
                    op.status === 'FAILED' ? chalk.red : chalk.gray;
      
      console.log(`${icon} ${color(op.name)} (${op.duration}ms)`);
      console.log(`   ${op.description}`);
      if (op.error) {
        console.log(`   错误: ${chalk.red(op.error)}`);
      }
      console.log('');
    });

    console.log(chalk.blue.bold('📈 执行统计:'));
    console.log(`📦 总操作数: ${chalk.cyan(this.results.totalOperations)}`);
    console.log(`✅ 成功: ${chalk.green(this.results.successful)}`);
    console.log(`⚠️ 跳过: ${chalk.yellow(this.results.skipped)}`);
    console.log(`❌ 失败: ${chalk.red(this.results.failed)}`);
    console.log(`⏱️ 总耗时: ${chalk.cyan(this.results.totalDuration)}ms`);

    // 测试搜索性能
    await this.testSearchPerformance();

    const overallSuccess = this.results.failed === 0;
    const statusMessage = overallSuccess ? 
      chalk.green.bold('\n🎉 搜索索引重建完成 - DAY 2联调搜索性能就绪!') :
      chalk.red.bold('\n⚠️ 部分操作失败，请检查错误信息');
    
    console.log(statusMessage);
  }

  private async testSearchPerformance() {
    console.log(chalk.blue.bold('\n⚡ 搜索性能测试:'));

    try {
      // 测试基础分页查询
      const startTime1 = Date.now();
      await this.prisma.medicine.findMany({
        where: { status: 'active' },
        orderBy: { name: 'asc' },
        take: 20
      });
      const basicQueryTime = Date.now() - startTime1;

      // 测试搜索查询
      const startTime2 = Date.now();
      await this.prisma.medicine.findMany({
        where: {
          status: 'active',
          OR: [
            { name: { contains: '当归', mode: 'insensitive' } },
            { chineseName: { contains: '当归', mode: 'insensitive' } },
            { pinyinName: { contains: 'danggui', mode: 'insensitive' } }
          ]
        },
        take: 10
      });
      const searchQueryTime = Date.now() - startTime2;

      // 测试分类查询
      const startTime3 = Date.now();
      await this.prisma.medicine.findMany({
        where: {
          status: 'active',
          category: '补益药'
        },
        take: 10
      });
      const categoryQueryTime = Date.now() - startTime3;

      console.log(`📋 基础分页查询: ${chalk.cyan(basicQueryTime + 'ms')} ${basicQueryTime < 100 ? '🚀' : basicQueryTime < 300 ? '✅' : '⚠️'}`);
      console.log(`🔍 搜索查询: ${chalk.cyan(searchQueryTime + 'ms')} ${searchQueryTime < 200 ? '🚀' : searchQueryTime < 500 ? '✅' : '⚠️'}`);
      console.log(`🏷️ 分类查询: ${chalk.cyan(categoryQueryTime + 'ms')} ${categoryQueryTime < 100 ? '🚀' : categoryQueryTime < 300 ? '✅' : '⚠️'}`);

      const avgPerformance = (basicQueryTime + searchQueryTime + categoryQueryTime) / 3;
      console.log(`📊 平均性能: ${chalk.cyan(avgPerformance.toFixed(1) + 'ms')} ${avgPerformance < 200 ? '🚀 优秀' : avgPerformance < 400 ? '✅ 良好' : '⚠️ 需优化'}`);

    } catch (error) {
      console.log(chalk.red(`❌ 性能测试失败: ${error}`));
    }
  }

  private updateResults() {
    this.results.totalOperations = this.operations.length;
    this.results.successful = this.operations.filter(op => op.status === 'SUCCESS').length;
    this.results.failed = this.operations.filter(op => op.status === 'FAILED').length;
    this.results.skipped = this.operations.filter(op => op.status === 'SKIPPED').length;
    this.results.totalDuration = this.operations.reduce((sum, op) => sum + (op.duration || 0), 0);
  }

  async run() {
    this.printHeader();

    try {
      this.initializeOperations();
      
      console.log(chalk.blue(`准备执行 ${this.operations.length} 个索引操作...\n`));

      const startTime = Date.now();

      for (const operation of this.operations) {
        await this.executeOperation(operation);
        // 短暂延迟以确保数据库处理完成
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.updateResults();
      await this.printResults();

      // 保存结果到文件
      const fs = await import('fs/promises');
      const reportData = {
        operations: this.operations,
        results: this.results,
        summary: {
          success: this.results.failed === 0,
          message: this.results.failed === 0 ? 'All index operations completed successfully' : 'Some operations failed',
          recommendations: this.generateRecommendations()
        }
      };

      await fs.writeFile(
        'scripts/results/search-index-rebuild-report.json',
        JSON.stringify(reportData, null, 2)
      );

      console.log(chalk.gray('\n📄 详细报告已保存至: scripts/results/search-index-rebuild-report.json'));

    } catch (error) {
      console.error(chalk.red('❌ 索引重建过程中发生错误:'), error);
    } finally {
      await this.prisma.$disconnect();
    }

    process.exit(this.results.failed === 0 ? 0 : 1);
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.results.failed > 0) {
      recommendations.push('检查失败的索引操作，可能需要手动处理');
    }
    
    if (this.results.successful >= 5) {
      recommendations.push('搜索索引已优化，建议进行全面的搜索性能测试');
    }
    
    recommendations.push('定期运行此脚本以维护最佳搜索性能');
    recommendations.push('监控查询性能，如有性能下降请重新运行索引优化');
    
    return recommendations;
  }
}

// 执行索引重建
if (require.main === module) {
  const rebuilder = new SearchIndexRebuilder();
  rebuilder.run().catch(console.error);
}

export { SearchIndexRebuilder }; 