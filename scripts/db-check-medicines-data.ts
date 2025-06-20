#!/usr/bin/env npx tsx

import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';

interface DatabaseCheckResult {
  success: boolean;
  checks: Array<{
    name: string;
    status: 'PASS' | 'FAIL' | 'WARNING';
    details: string;
    value?: string | number;
  }>;
  summary: {
    totalMedicines: number;
    activeMedicines: number;
    categoriesCount: number;
    averagePrice: number;
    indexesStatus: string;
  };
  timestamp: string;
}

class MedicinesDatabaseChecker {
  private prisma: PrismaClient;
  private result: DatabaseCheckResult;

  constructor() {
    this.prisma = new PrismaClient();
    this.result = {
      success: true,
      checks: [],
      summary: {
        totalMedicines: 0,
        activeMedicines: 0,
        categoriesCount: 0,
        averagePrice: 0,
        indexesStatus: 'UNKNOWN'
      },
      timestamp: new Date().toISOString()
    };
  }

  private addCheck(name: string, status: 'PASS' | 'FAIL' | 'WARNING', details: string, value?: string | number) {
    this.result.checks.push({ name, status, details, value });
    if (status === 'FAIL') {
      this.result.success = false;
    }
  }

  private printHeader() {
    console.log(chalk.blue.bold('\n🔍 药品数据库完整性检查'));
    console.log(chalk.gray('=' .repeat(60)));
    console.log(chalk.yellow(`检查时间: ${new Date().toLocaleString()}`));
    console.log('');
  }

  private printResults() {
    console.log(chalk.blue.bold('\n📊 检查结果详情:'));
    
    this.result.checks.forEach(check => {
      const icon = check.status === 'PASS' ? '✅' : check.status === 'WARNING' ? '⚠️' : '❌';
      const color = check.status === 'PASS' ? chalk.green : check.status === 'WARNING' ? chalk.yellow : chalk.red;
      
      console.log(`${icon} ${color(check.name)}`);
      console.log(`   ${check.details}`);
      if (check.value !== undefined) {
        console.log(`   值: ${chalk.cyan(check.value)}`);
      }
      console.log('');
    });

    console.log(chalk.blue.bold('📈 数据库概览:'));
    console.log(`📦 总药品数量: ${chalk.cyan(this.result.summary.totalMedicines)}`);
    console.log(`✅ 活跃药品数量: ${chalk.cyan(this.result.summary.activeMedicines)}`);
    console.log(`🏷️  药品分类数量: ${chalk.cyan(this.result.summary.categoriesCount)}`);
    console.log(`💰 平均价格: ${chalk.cyan('¥' + this.result.summary.averagePrice.toFixed(2))}`);
    console.log(`🔍 索引状态: ${chalk.cyan(this.result.summary.indexesStatus)}`);

    const overallStatus = this.result.success ? 
      chalk.green.bold('\n🎉 数据库状态: EXCELLENT - DAY 2联调就绪!') : 
      chalk.red.bold('\n⚠️ 数据库状态: 需要修复问题后才能启动联调');
    
    console.log(overallStatus);
  }

  async checkDataIntegrity() {
    console.log(chalk.blue('🔍 检查数据完整性...'));

    // 检查药品总数
    const totalCount = await this.prisma.medicine.count();
    this.result.summary.totalMedicines = totalCount;
    
    if (totalCount === 0) {
      this.addCheck('药品数据存在性', 'FAIL', '数据库中没有药品数据，需要导入数据', totalCount);
      return;
    }

    this.addCheck('药品数据存在性', 'PASS', `发现 ${totalCount} 条药品记录`, totalCount);

    // 检查活跃药品数量
    const activeCount = await this.prisma.medicine.count({
      where: { status: 'active' }
    });
    this.result.summary.activeMedicines = activeCount;

    if (activeCount < totalCount * 0.8) {
      this.addCheck('活跃药品比例', 'WARNING', `活跃药品比例较低: ${activeCount}/${totalCount}`, `${((activeCount/totalCount)*100).toFixed(1)}%`);
    } else {
      this.addCheck('活跃药品比例', 'PASS', `活跃药品比例健康: ${activeCount}/${totalCount}`, `${((activeCount/totalCount)*100).toFixed(1)}%`);
    }

    // 检查必填字段完整性 - 使用原始查询避免Prisma语法问题
    const invalidMedicinesResult = await this.prisma.$queryRaw<Array<{count: bigint}>>`
      SELECT COUNT(*) as count FROM medicines 
      WHERE name IS NULL OR name = '' OR sku IS NULL OR sku = ''
    `;
    const invalidMedicines = Number(invalidMedicinesResult[0]?.count || 0);

    if (invalidMedicines > 0) {
      this.addCheck('必填字段完整性', 'FAIL', `发现 ${invalidMedicines} 条记录缺少必填字段`, invalidMedicines);
    } else {
      this.addCheck('必填字段完整性', 'PASS', '所有记录的必填字段完整', 0);
    }

    // 检查SKU唯一性
    const duplicateSkus = await this.prisma.$queryRaw<Array<{sku: string, count: number}>>`
      SELECT sku, COUNT(*) as count 
      FROM medicines 
      GROUP BY sku 
      HAVING COUNT(*) > 1
    `;

    if (duplicateSkus.length > 0) {
      this.addCheck('SKU唯一性', 'FAIL', `发现 ${duplicateSkus.length} 个重复的SKU`, duplicateSkus.map(d => d.sku).join(', '));
    } else {
      this.addCheck('SKU唯一性', 'PASS', '所有SKU都是唯一的', 0);
    }
  }

  async checkCategories() {
    console.log(chalk.blue('🏷️  检查药品分类...'));

    const categories = await this.prisma.medicine.groupBy({
      by: ['category'],
      where: { status: 'active', category: { not: null } },
      _count: { category: true }
    });

    this.result.summary.categoriesCount = categories.length;

    if (categories.length === 0) {
      this.addCheck('药品分类', 'FAIL', '没有找到任何药品分类', 0);
    } else if (categories.length < 3) {
      this.addCheck('药品分类', 'WARNING', `分类数量较少: ${categories.length}`, categories.length);
    } else {
      this.addCheck('药品分类', 'PASS', `分类分布健康: ${categories.length} 个分类`, categories.length);
    }

    // 显示分类分布
    const categoryDistribution = categories
      .sort((a, b) => b._count.category - a._count.category)
      .slice(0, 5)
      .map(c => `${c.category}: ${c._count.category}`)
      .join(', ');
    
    if (categoryDistribution) {
      this.addCheck('分类分布', 'PASS', `主要分类分布: ${categoryDistribution}`, categories.length);
    }
  }

  async checkPricing() {
    console.log(chalk.blue('💰 检查价格数据...'));

    const priceStats = await this.prisma.medicine.aggregate({
      where: { status: 'active' },
      _avg: { basePrice: true },
      _min: { basePrice: true },
      _max: { basePrice: true },
      _count: { basePrice: true }
    });

    const avgPrice = priceStats._avg.basePrice?.toNumber() || 0;
    const minPrice = priceStats._min.basePrice?.toNumber() || 0;
    const maxPrice = priceStats._max.basePrice?.toNumber() || 0;

    this.result.summary.averagePrice = avgPrice;

    if (avgPrice === 0) {
      this.addCheck('价格数据', 'FAIL', '所有药品价格为0，需要更新价格数据', 0);
    } else if (avgPrice < 0.1) {
      this.addCheck('价格数据', 'WARNING', `平均价格过低: ¥${avgPrice.toFixed(2)}`, avgPrice);
    } else {
      this.addCheck('价格数据', 'PASS', `价格数据合理: ¥${minPrice.toFixed(2)} - ¥${maxPrice.toFixed(2)}, 平均¥${avgPrice.toFixed(2)}`, avgPrice);
    }

    // 检查是否有异常价格
    const expensiveMedicines = await this.prisma.medicine.count({
      where: { 
        status: 'active',
        basePrice: { gt: 100 }
      }
    });

    if (expensiveMedicines > 0) {
      this.addCheck('高价药品', 'WARNING', `发现 ${expensiveMedicines} 个高价药品(>¥100)，请确认价格正确`, expensiveMedicines);
    }
  }

  async checkSearchCapability() {
    console.log(chalk.blue('🔍 检查搜索功能...'));

    // 测试中文搜索
    const chineseSearchResults = await this.prisma.medicine.count({
      where: {
        status: 'active',
        OR: [
          { name: { contains: '当', mode: 'insensitive' } },
          { chineseName: { contains: '当', mode: 'insensitive' } }
        ]
      }
    });

    // 测试拼音搜索
    const pinyinSearchResults = await this.prisma.medicine.count({
      where: {
        status: 'active',
        pinyinName: { contains: 'dang', mode: 'insensitive' }
      }
    });

    // 测试英文搜索
    const englishSearchResults = await this.prisma.medicine.count({
      where: {
        status: 'active',
        englishName: { contains: 'Angelica', mode: 'insensitive' }
      }
    });

    const totalSearchCapable = chineseSearchResults + pinyinSearchResults + englishSearchResults;

    if (totalSearchCapable === 0) {
      this.addCheck('搜索功能', 'FAIL', '搜索功能无法找到任何结果，可能存在数据或索引问题', 0);
    } else {
      this.addCheck('搜索功能', 'PASS', 
        `搜索功能正常: 中文(${chineseSearchResults}) 拼音(${pinyinSearchResults}) 英文(${englishSearchResults})`, 
        totalSearchCapable);
    }
  }

  async checkPerformance() {
    console.log(chalk.blue('⚡ 检查查询性能...'));

    const startTime = Date.now();
    
    // 执行典型的分页查询
    await this.prisma.medicine.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' },
      skip: 0,
      take: 20
    });

    const queryTime = Date.now() - startTime;

    if (queryTime > 1000) {
      this.addCheck('查询性能', 'FAIL', `分页查询耗时过长: ${queryTime}ms (标准: <300ms)`, `${queryTime}ms`);
    } else if (queryTime > 300) {
      this.addCheck('查询性能', 'WARNING', `分页查询耗时较长: ${queryTime}ms (建议: <300ms)`, `${queryTime}ms`);
    } else {
      this.addCheck('查询性能', 'PASS', `分页查询性能优秀: ${queryTime}ms`, `${queryTime}ms`);
    }

    // 测试搜索查询性能
    const searchStartTime = Date.now();
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
    const searchTime = Date.now() - searchStartTime;

    if (searchTime > 500) {
      this.addCheck('搜索性能', 'WARNING', `搜索查询耗时: ${searchTime}ms (建议: <500ms)`, `${searchTime}ms`);
    } else {
      this.addCheck('搜索性能', 'PASS', `搜索查询性能良好: ${searchTime}ms`, `${searchTime}ms`);
    }

    this.result.summary.indexesStatus = queryTime < 300 && searchTime < 500 ? 'OPTIMIZED' : 'NEEDS_OPTIMIZATION';
  }

  async run() {
    this.printHeader();

    try {
      await this.checkDataIntegrity();
      await this.checkCategories();
      await this.checkPricing();
      await this.checkSearchCapability();
      await this.checkPerformance();
      
      this.printResults();

      // 输出结果到文件
      const fs = await import('fs/promises');
      await fs.writeFile(
        'scripts/results/medicines-db-check-report.json',
        JSON.stringify(this.result, null, 2)
      );

      console.log(chalk.gray('\n📄 详细报告已保存至: scripts/results/medicines-db-check-report.json'));

    } catch (error) {
      console.error(chalk.red('❌ 检查过程中发生错误:'), error);
      this.result.success = false;
    } finally {
      await this.prisma.$disconnect();
    }

    process.exit(this.result.success ? 0 : 1);
  }
}

// 执行检查
if (require.main === module) {
  const checker = new MedicinesDatabaseChecker();
  checker.run().catch(console.error);
}

export { MedicinesDatabaseChecker }; 