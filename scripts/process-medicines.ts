#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'csv-stringify/sync';
import { TsvParser } from './modules/tsv-parser.js';
import { PinyinGenerator } from './modules/pinyin-generator.js';
import { SkuGenerator } from './modules/sku-generator.js';
import { DataValidator } from './modules/data-validator.js';
import { logger } from './utils/logger.js';
import { 
  InputMedicineData, 
  ProcessingMedicineData, 
  CompleteMedicineData, 
  BatchProcessingResult,
  ProcessingResult 
} from './types/medicine-types.js';

/**
 * 药品数据处理主程序
 * 完整的TSV到数据库格式转换流程
 */
class MedicineProcessor {
  private parser: TsvParser;
  private pinyinGenerator: PinyinGenerator;
  private skuGenerator: SkuGenerator;
  private validator: DataValidator;
  private outputDir: string;

  constructor(outputDir: string = 'output') {
    this.parser = new TsvParser();
    this.pinyinGenerator = new PinyinGenerator();
    this.skuGenerator = new SkuGenerator();
    this.validator = new DataValidator();
    this.outputDir = outputDir;

    // 确保输出目录存在
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * 处理TSV文件的完整流程
   */
  async processFile(inputFilePath: string): Promise<BatchProcessingResult> {
    const startTime = new Date();
    logger.separator(`🚀 开始处理药品数据文件: ${path.basename(inputFilePath)}`);

    try {
      // 第1步：解析TSV文件
      logger.info('第1步: 解析TSV文件...');
      const parseResult = await this.parser.parseFile(inputFilePath);
      
      if (parseResult.errors.length > 0) {
        logger.warn(`解析过程中发现 ${parseResult.errors.length} 个错误`);
        parseResult.errors.forEach(error => {
          logger.warn(`  行${error.index}: ${error.error}`);
        });
      }

      if (parseResult.data.length === 0) {
        throw new Error('没有有效数据可处理');
      }

      logger.success(`✅ TSV解析完成: ${parseResult.data.length} 条有效记录`);

      // 第2步：数据验证
      logger.info('第2步: 输入数据验证...');
      const inputValidation = this.validator.validateInputData(parseResult.data);
      
      if (!inputValidation.isValid) {
        logger.error('输入数据验证失败:');
        inputValidation.errors.forEach(error => logger.error(`  - ${error}`));
        throw new Error('输入数据验证失败');
      }

      if (inputValidation.warnings.length > 0) {
        logger.warn('输入数据警告:');
        inputValidation.warnings.forEach(warning => logger.warn(`  - ${warning}`));
      }

      logger.success(`✅ 输入验证通过: ${inputValidation.summary.valid}/${inputValidation.summary.total} 条记录`);

      // 第3步：生成拼音和SKU
      logger.info('第3步: 生成拼音名称和SKU代码...');
      const processingData = await this.processRecords(parseResult.data);
      
      logger.success(`✅ 处理完成: ${processingData.length} 条记录`);

      // 第4步：处理后数据验证
      logger.info('第4步: 处理后数据验证...');
      const processingValidation = this.validator.validateProcessingData(processingData);
      
      if (!processingValidation.isValid) {
        logger.warn('处理后数据验证发现问题:');
        processingValidation.errors.forEach(error => logger.warn(`  - ${error}`));
      }

      if (processingValidation.warnings.length > 0) {
        logger.info('处理后数据警告:');
        processingValidation.warnings.forEach(warning => logger.info(`  - ${warning}`));
      }

      // 第5步：转换为完整数据格式
      logger.info('第5步: 转换为数据库格式...');
      const completeData = this.convertToCompleteData(processingData);
      
      // 第6步：最终数据验证
      logger.info('第6步: 最终数据验证...');
      const outputValidation = this.validator.validateOutputData(completeData);
      
      if (!outputValidation.isValid) {
        logger.warn('最终数据验证发现问题:');
        outputValidation.errors.forEach(error => logger.warn(`  - ${error}`));
      }

      // 第7步：生成输出文件
      logger.info('第7步: 生成输出文件...');
      await this.generateOutputFiles(completeData, processingData, inputFilePath);

      // 第8步：生成处理报告
      logger.info('第8步: 生成处理报告...');
      const batchResult = this.generateBatchResult(
        parseResult.data,
        processingData,
        completeData,
        startTime,
        new Date()
      );

      await this.generateProcessingReport(batchResult, inputFilePath);

      logger.separator('🎉 药品数据处理完成');
      this.printSummary(batchResult);

      return batchResult;

    } catch (error) {
      const endTime = new Date();
      logger.error(`❌ 处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
      
      throw error;
    }
  }

  /**
   * 处理单条记录（生成拼音和SKU）
   */
  private async processRecords(inputData: InputMedicineData[]): Promise<ProcessingMedicineData[]> {
    const results: ProcessingMedicineData[] = [];
    let processed = 0;

    for (let i = 0; i < inputData.length; i++) {
      const input = inputData[i];
      
      try {
        // 生成拼音
        const pinyinResult = this.pinyinGenerator.generatePinyin(input.chineseName);
        if (!pinyinResult.success) {
          logger.warn(`第${i + 1}行拼音生成失败: ${input.chineseName}`);
        }

        // 生成SKU
        const skuResult = this.skuGenerator.generateSku(input.chineseName, pinyinResult.pinyin);
        if (!skuResult.success) {
          logger.warn(`第${i + 1}行SKU生成失败: ${input.chineseName}`);
        }

        // 组装处理后数据
        const processedData: ProcessingMedicineData = {
          ...input,
          pinyinName: pinyinResult.pinyin,
          sku: skuResult.sku,
          index: i + 1
        };

        results.push(processedData);
        processed++;

        // 显示进度
        if (processed % 10 === 0 || processed === inputData.length) {
          logger.progress(processed, inputData.length, `已处理 ${processed}/${inputData.length} 条记录`);
        }

      } catch (error) {
        logger.error(`第${i + 1}行处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
        // 继续处理其他记录
      }
    }

    return results;
  }

  /**
   * 转换为完整数据库格式
   */
  private convertToCompleteData(processingData: ProcessingMedicineData[]): CompleteMedicineData[] {
    return processingData.map(data => ({
      name: data.chineseName,
      chineseName: data.chineseName,
      englishName: data.englishName,
      pinyinName: data.pinyinName,
      sku: data.sku,
      description: `${data.chineseName} (${data.englishName})`,
      category: this.inferCategory(data.chineseName),
      unit: 'g',
      requiresPrescription: this.requiresPrescription(data.chineseName),
      basePrice: data.pricePerGram,
      metadata: {
        importIndex: data.index,
        processedAt: new Date().toISOString(),
        originalData: {
          chineseName: data.chineseName,
          englishName: data.englishName,
          pricePerGram: data.pricePerGram
        }
      },
      status: 'active'
    }));
  }

  /**
   * 推断药材分类
   */
  private inferCategory(chineseName: string): string {
    // 基于常见中药名称推断分类
    const categories = {
      '补益药': ['人参', '党参', '黄芪', '当归', '熟地', '枸杞', '杜仲'],
      '清热药': ['金银花', '连翘', '板蓝根', '大青叶', '蒲公英', '野菊花'],
      '理气药': ['陈皮', '佛手', '香附', '木香', '沉香'],
      '活血药': ['川芎', '红花', '桃仁', '丹参', '三七'],
      '化痰药': ['半夏', '陈皮', '茯苓', '白术', '苍术'],
      '止咳药': ['川贝', '浙贝', '杏仁', '桔梗', '紫菀'],
      '安神药': ['酸枣仁', '远志', '龙骨', '牡蛎', '朱砂']
    };

    for (const [category, herbs] of Object.entries(categories)) {
      if (herbs.some(herb => chineseName.includes(herb))) {
        return category;
      }
    }

    return '其他中药';
  }

  /**
   * 判断是否需要处方
   */
  private requiresPrescription(chineseName: string): boolean {
    // 有毒或需要特别注意的药材
    const prescriptionRequired = [
      '附子', '乌头', '半夏', '天南星', '雄黄', '朱砂', '轻粉', 
      '藏红花', '麝香', '牛黄', '冰片', '樟脑'
    ];

    return prescriptionRequired.some(herb => chineseName.includes(herb));
  }

  /**
   * 生成输出文件
   */
  private async generateOutputFiles(
    completeData: CompleteMedicineData[], 
    processingData: ProcessingMedicineData[], 
    inputFilePath: string
  ): Promise<void> {
    const baseName = path.basename(inputFilePath, '.tsv');

    // 1. 生成JSON格式
    const jsonFilePath = path.join(this.outputDir, `${baseName}-processed.json`);
    fs.writeFileSync(jsonFilePath, JSON.stringify(completeData, null, 2), 'utf-8');
    logger.success(`✅ JSON文件已生成: ${jsonFilePath}`);

    // 2. 生成CSV格式
    const csvData = completeData.map(item => ({
      '中文名': item.chineseName,
      '英文名': item.englishName,
      '拼音名': item.pinyinName,
      'SKU': item.sku,
      '分类': item.category,
      '单位': item.unit,
      '需要处方': item.requiresPrescription ? '是' : '否',
      '基础价格': item.basePrice,
      '状态': item.status
    }));

    const csvContent = stringify(csvData, { header: true });
    const csvFilePath = path.join(this.outputDir, `${baseName}-processed.csv`);
    fs.writeFileSync(csvFilePath, csvContent, 'utf-8');
    logger.success(`✅ CSV文件已生成: ${csvFilePath}`);

    // 3. 生成详细数据文件（包含元数据）
    const detailedFilePath = path.join(this.outputDir, `${baseName}-detailed.json`);
    const detailedData = {
      metadata: {
        processedAt: new Date().toISOString(),
        inputFile: inputFilePath,
        totalRecords: completeData.length,
        version: '1.0.0'
      },
      medicines: completeData
    };
    fs.writeFileSync(detailedFilePath, JSON.stringify(detailedData, null, 2), 'utf-8');
    logger.success(`✅ 详细数据文件已生成: ${detailedFilePath}`);
  }

  /**
   * 生成批处理结果
   */
  private generateBatchResult(
    inputData: InputMedicineData[],
    processingData: ProcessingMedicineData[],
    completeData: CompleteMedicineData[],
    startTime: Date,
    endTime: Date
  ): BatchProcessingResult {
    const results: ProcessingResult[] = processingData.map((processed, index) => ({
      success: true,
      input: inputData[index],
      output: completeData[index],
      index: index + 1,
      warnings: []
    }));

    return {
      totalRecords: inputData.length,
      successCount: processingData.length,
      failureCount: inputData.length - processingData.length,
      warningCount: 0, // 这里可以统计警告数量
      results,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime()
    };
  }

  /**
   * 生成处理报告
   */
  private async generateProcessingReport(result: BatchProcessingResult, inputFilePath: string): Promise<void> {
    const baseName = path.basename(inputFilePath, '.tsv');
    const reportPath = path.join(this.outputDir, `${baseName}-report.json`);

    // 统计信息
    const stats = {
      processing: {
        totalRecords: result.totalRecords,
        successCount: result.successCount,
        failureCount: result.failureCount,
        successRate: ((result.successCount / result.totalRecords) * 100).toFixed(2) + '%',
        duration: result.duration + 'ms',
        averageTimePerRecord: Math.round(result.duration / result.totalRecords) + 'ms'
      },
      sku: this.skuGenerator.getStats(),
      pinyin: {
        specialMappingsUsed: this.pinyinGenerator.getSpecialMappingsCount(),
        totalGenerated: result.successCount
      },
      categories: this.getCategoryStats(result.results),
      prices: this.getPriceStats(result.results)
    };

    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        inputFile: inputFilePath,
        processor: 'Medicine Data Processor v1.0.0'
      },
      summary: stats,
      details: {
        startTime: result.startTime.toISOString(),
        endTime: result.endTime.toISOString(),
        totalDuration: result.duration
      },
      results: result.results.map(r => ({
        index: r.index,
        success: r.success,
        chineseName: r.input.chineseName,
        englishName: r.input.englishName,
        pinyinName: r.output?.pinyinName,
        sku: r.output?.sku,
        category: r.output?.category,
        warnings: r.warnings
      }))
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    logger.success(`✅ 处理报告已生成: ${reportPath}`);
  }

  /**
   * 获取分类统计
   */
  private getCategoryStats(results: ProcessingResult[]): Record<string, number> {
    const stats: Record<string, number> = {};
    
    results.forEach(result => {
      if (result.output?.category) {
        stats[result.output.category] = (stats[result.output.category] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * 获取价格统计
   */
  private getPriceStats(results: ProcessingResult[]): any {
    const prices = results.map(r => r.input.pricePerGram).filter(p => p > 0);
    
    if (prices.length === 0) {
      return { min: 0, max: 0, average: 0, median: 0 };
    }

    const sorted = [...prices].sort((a, b) => a - b);
    
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      average: parseFloat((prices.reduce((sum, p) => sum + p, 0) / prices.length).toFixed(2)),
      median: sorted[Math.floor(sorted.length / 2)]
    };
  }

  /**
   * 打印处理摘要
   */
  private printSummary(result: BatchProcessingResult): void {
    logger.info('📊 处理摘要:');
    logger.info(`  📝 总记录数: ${result.totalRecords}`);
    logger.info(`  ✅ 成功处理: ${result.successCount}`);
    logger.info(`  ❌ 处理失败: ${result.failureCount}`);
    logger.info(`  ⚠️  警告数量: ${result.warningCount}`);
    logger.info(`  ⏱️  处理耗时: ${result.duration}ms`);
    logger.info(`  🚀 平均速度: ${Math.round(result.duration / result.totalRecords)}ms/条`);
    
    const successRate = ((result.successCount / result.totalRecords) * 100).toFixed(1);
    logger.info(`  📈 成功率: ${successRate}%`);

    // SKU统计
    const skuStats = this.skuGenerator.getStats();
    logger.info(`  🏷️  SKU统计:`);
    logger.info(`    - 总计: ${skuStats.totalSkus}`);
    logger.info(`    - 首字母: ${skuStats.initialsCount}`);
    logger.info(`    - 完整拼音: ${skuStats.fullPinyinCount}`);
    logger.info(`    - 备用方案: ${skuStats.fallbackCount}`);
  }
}

/**
 * 命令行主函数
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
药品数据处理工具 v1.0.0

用法: npx tsx process-medicines.ts <TSV文件路径> [选项]

参数:
  <TSV文件路径>    输入的TSV格式药品数据文件

选项:
  --output <目录>   指定输出目录 (默认: output)
  --help, -h       显示帮助信息

示例:
  npx tsx process-medicines.ts sample-data/small-sample.tsv
  npx tsx process-medicines.ts data.tsv --output results
  npx tsx process-medicines.ts sample-data/error-sample.tsv

支持的输入格式:
  - TSV文件，制表符分隔
  - UTF-8编码
  - 表头: 中文名	英文名	价格

输出文件:
  - <文件名>-processed.json    完整的JSON数据
  - <文件名>-processed.csv     CSV格式数据  
  - <文件名>-detailed.json     包含元数据的详细数据
  - <文件名>-report.json       处理报告和统计信息
`);
    return;
  }

  const inputFile = args[0];
  let outputDir = 'output';

  // 解析输出目录选项
  const outputIndex = args.indexOf('--output');
  if (outputIndex !== -1 && outputIndex + 1 < args.length) {
    outputDir = args[outputIndex + 1];
  }

  // 检查输入文件
  if (!fs.existsSync(inputFile)) {
    logger.error(`❌ 输入文件不存在: ${inputFile}`);
    process.exit(1);
  }

  try {
    const processor = new MedicineProcessor(outputDir);
    await processor.processFile(inputFile);
    
    logger.success('🎉 所有处理完成！');
    process.exit(0);
    
  } catch (error) {
    logger.error(`❌ 处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    process.exit(1);
  }
}

// 执行主函数
main(); 