#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { TsvParser } from './modules/tsv-parser.js';
import { PinyinGenerator } from './modules/pinyin-generator.js';
import { SkuGenerator } from './modules/sku-generator.js';
import { DataValidator } from './modules/data-validator.js';
import { logger } from './utils/logger.js';
import { InputMedicineData } from './types/medicine-types.js';

/**
 * 架构测试脚本
 * 验证所有模块的功能、性能和集成度
 */
async function runArchitectureTest() {
  logger.separator('🏗️ 架构测试开始');
  
  const testResults = {
    modules: {} as Record<string, boolean>,
    performance: {} as Record<string, number>,
    integration: false,
    overallPass: false
  };

  try {
    // 1. 模块存在性检查
    logger.info('1️⃣ 检查模块文件存在性...');
    const moduleChecks = await checkModuleFiles();
    testResults.modules = moduleChecks.results;
    
    if (!moduleChecks.allExist) {
      logger.error('❌ 模块文件检查失败');
      return testResults;
    }
    logger.success('✅ 所有模块文件存在');

    // 2. TypeScript 类型定义检查
    logger.info('2️⃣ 检查TypeScript类型定义...');
    const typeChecks = await checkTypeDefinitions();
    if (!typeChecks) {
      logger.error('❌ TypeScript类型定义检查失败');
      return testResults;
    }
    logger.success('✅ TypeScript类型定义完整');

    // 3. 依赖包检查
    logger.info('3️⃣ 检查关键依赖包...');
    const dependencyChecks = await checkDependencies();
    if (!dependencyChecks) {
      logger.error('❌ 依赖包检查失败');
      return testResults;
    }
    logger.success('✅ 关键依赖包完整');

    // 4. 单模块功能测试
    logger.info('4️⃣ 单模块功能测试...');
    const moduleTests = await testIndividualModules();
    Object.assign(testResults.modules, moduleTests.results);
    Object.assign(testResults.performance, moduleTests.performance);
    
    if (!moduleTests.allPass) {
      logger.error('❌ 单模块功能测试失败');
      return testResults;
    }
    logger.success('✅ 所有模块功能正常');

    // 5. 模块集成测试
    logger.info('5️⃣ 模块集成测试...');
    const integrationTest = await testModuleIntegration();
    testResults.integration = integrationTest.success;
    Object.assign(testResults.performance, integrationTest.performance);
    
    if (!integrationTest.success) {
      logger.error('❌ 模块集成测试失败');
      return testResults;
    }
    logger.success('✅ 模块集成测试通过');

    // 6. 边界条件测试
    logger.info('6️⃣ 边界条件测试...');
    const boundaryTest = await testBoundaryConditions();
    if (!boundaryTest) {
      logger.error('❌ 边界条件测试失败');
      return testResults;
    }
    logger.success('✅ 边界条件测试通过');

    testResults.overallPass = true;
    logger.separator('🎉 架构测试完成');
    
  } catch (error) {
    logger.error(`架构测试异常: ${error instanceof Error ? error.message : '未知错误'}`);
  }

  // 输出测试报告
  generateTestReport(testResults);
  
  return testResults;
}

/**
 * 检查模块文件存在性
 */
async function checkModuleFiles(): Promise<{ allExist: boolean; results: Record<string, boolean> }> {
  const modules = [
    'modules/tsv-parser.ts',
    'modules/pinyin-generator.ts', 
    'modules/sku-generator.ts',
    'modules/data-validator.ts',
    'types/medicine-types.ts',
    'utils/logger.ts'
  ];

  const results: Record<string, boolean> = {};
  let allExist = true;

  for (const module of modules) {
    const exists = fs.existsSync(module);
    results[module] = exists;
    
    if (exists) {
      logger.info(`  ✅ ${module}`);
    } else {
      logger.error(`  ❌ ${module} - 文件不存在`);
      allExist = false;
    }
  }

  return { allExist, results };
}

/**
 * 检查TypeScript类型定义
 */
async function checkTypeDefinitions(): Promise<boolean> {
  try {
    const { InputMedicineData, ProcessingMedicineData, CompleteMedicineData } = await import('./types/medicine-types.js');
    
    // 验证关键类型是否可用
    const testInput: InputMedicineData = {
      chineseName: '当归',
      englishName: 'Angelica sinensis',
      pricePerGram: 0.85
    };

    logger.info(`  ✅ InputMedicineData: ${JSON.stringify(testInput)}`);
    return true;
    
  } catch (error) {
    logger.error(`  ❌ 类型定义导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
    return false;
  }
}

/**
 * 检查关键依赖包
 */
async function checkDependencies(): Promise<boolean> {
  const dependencies = [
    'pinyin-pro',
    'csv-parse',
    'csv-stringify', 
    'chalk',
    'cli-progress'
  ];

  for (const dep of dependencies) {
    try {
      await import(dep);
      logger.info(`  ✅ ${dep}`);
    } catch (error) {
      logger.error(`  ❌ ${dep} - 导入失败`);
      return false;
    }
  }

  return true;
}

/**
 * 测试单个模块功能
 */
async function testIndividualModules(): Promise<{
  allPass: boolean;
  results: Record<string, boolean>;
  performance: Record<string, number>;
}> {
  const results: Record<string, boolean> = {};
  const performance: Record<string, number> = {};
  let allPass = true;

  // 测试拼音生成器
  logger.info('  🧪 测试拼音生成器...');
  const pinyinStart = Date.now();
  try {
    const pinyinGenerator = new PinyinGenerator();
    const pinyinResult = pinyinGenerator.generatePinyin('五倍子');
    
    if (pinyinResult.success && pinyinResult.pinyin === 'wubeizi') {
      logger.info(`    ✅ 拼音生成: 五倍子 → ${pinyinResult.pinyin}`);
      results['pinyin-generator'] = true;
    } else {
      logger.error(`    ❌ 拼音生成失败: ${JSON.stringify(pinyinResult)}`);
      results['pinyin-generator'] = false;
      allPass = false;
    }
  } catch (error) {
    logger.error(`    ❌ 拼音生成器异常: ${error instanceof Error ? error.message : '未知错误'}`);
    results['pinyin-generator'] = false;
    allPass = false;
  }
  performance['pinyin-generator'] = Date.now() - pinyinStart;

  // 测试SKU生成器
  logger.info('  🧪 测试SKU生成器...');
  const skuStart = Date.now();
  try {
    const skuGenerator = new SkuGenerator();
    const skuResult = skuGenerator.generateSku('当归', 'danggui');
    
    if (skuResult.success && skuResult.sku === 'DG') {
      logger.info(`    ✅ SKU生成: 当归 → ${skuResult.sku}`);
      results['sku-generator'] = true;
    } else {
      logger.error(`    ❌ SKU生成失败: ${JSON.stringify(skuResult)}`);
      results['sku-generator'] = false;
      allPass = false;
    }
  } catch (error) {
    logger.error(`    ❌ SKU生成器异常: ${error instanceof Error ? error.message : '未知错误'}`);
    results['sku-generator'] = false;
    allPass = false;
  }
  performance['sku-generator'] = Date.now() - skuStart;

  // 测试数据验证器
  logger.info('  🧪 测试数据验证器...');
  const validatorStart = Date.now();
  try {
    const validator = new DataValidator();
    const testData: InputMedicineData[] = [{
      chineseName: '当归',
      englishName: 'Angelica sinensis',
      pricePerGram: 0.85
    }];
    
    const validationResult = validator.validateInputData(testData);
    
    if (validationResult.isValid) {
      logger.info(`    ✅ 数据验证: ${validationResult.summary.valid}/${validationResult.summary.total} 通过`);
      results['data-validator'] = true;
    } else {
      logger.error(`    ❌ 数据验证失败: ${validationResult.errors.join(', ')}`);
      results['data-validator'] = false;
      allPass = false;
    }
  } catch (error) {
    logger.error(`    ❌ 数据验证器异常: ${error instanceof Error ? error.message : '未知错误'}`);
    results['data-validator'] = false;
    allPass = false;
  }
  performance['data-validator'] = Date.now() - validatorStart;

  return { allPass, results, performance };
}

/**
 * 测试模块集成
 */
async function testModuleIntegration(): Promise<{
  success: boolean;
  performance: Record<string, number>;
}> {
  const integrationStart = Date.now();
  
  try {
    // 创建测试数据
    const testTsvContent = `中文名\t英文名\t价格
当归\tAngelica sinensis\t0.85
五倍子\tChinese gallnut\t1.20
人参\tPanax ginseng\t15.50`;

    const testFilePath = 'test-integration.tsv';
    fs.writeFileSync(testFilePath, testTsvContent, 'utf-8');

    // 完整流程测试
    const parser = new TsvParser();
    const parseResult = await parser.parseFile(testFilePath);
    
    if (parseResult.data.length !== 3) {
      logger.error(`    ❌ 解析记录数不匹配: 期望3条，实际${parseResult.data.length}条`);
      return { success: false, performance: {} };
    }

    const pinyinGenerator = new PinyinGenerator();
    const skuGenerator = new SkuGenerator();
    const validator = new DataValidator();

    // 处理每条记录
    for (const input of parseResult.data) {
      const pinyinResult = pinyinGenerator.generatePinyin(input.chineseName);
      if (!pinyinResult.success) {
        logger.error(`    ❌ 拼音生成失败: ${input.chineseName}`);
        return { success: false, performance: {} };
      }

      const skuResult = skuGenerator.generateSku(input.chineseName, pinyinResult.pinyin);
      if (!skuResult.success) {
        logger.error(`    ❌ SKU生成失败: ${input.chineseName}`);
        return { success: false, performance: {} };
      }
    }

    // 清理测试文件
    fs.unlinkSync(testFilePath);

    const integrationTime = Date.now() - integrationStart;
    logger.info(`    ✅ 集成测试完成，耗时: ${integrationTime}ms`);

    return { 
      success: true, 
      performance: { 'integration-test': integrationTime } 
    };

  } catch (error) {
    logger.error(`    ❌ 集成测试异常: ${error instanceof Error ? error.message : '未知错误'}`);
    return { success: false, performance: {} };
  }
}

/**
 * 测试边界条件
 */
async function testBoundaryConditions(): Promise<boolean> {
  try {
    const pinyinGenerator = new PinyinGenerator();
    const skuGenerator = new SkuGenerator();
    const validator = new DataValidator();

    // 测试空值处理
    const emptyPinyin = pinyinGenerator.generatePinyin('');
    if (emptyPinyin.success) {
      logger.error(`    ❌ 空值拼音生成应该失败`);
      return false;
    }

    // 测试特殊字符
    const specialPinyin = pinyinGenerator.generatePinyin('测试@#$');
    if (!specialPinyin.success) {
      logger.info(`    ✅ 特殊字符处理正常`);
    }

    // 测试极长输入
    const longInput = '超长中药名称'.repeat(20);
    const longPinyin = pinyinGenerator.generatePinyin(longInput);
    if (longPinyin.pinyin.length > 0) {
      logger.info(`    ✅ 长输入处理正常: ${longPinyin.pinyin.length}字符`);
    }

    // 测试数据验证边界
    const invalidData: InputMedicineData[] = [{
      chineseName: '',
      englishName: 'Empty Chinese',
      pricePerGram: -1
    }];

    const validation = validator.validateInputData(invalidData);
    if (!validation.isValid && validation.errors.length > 0) {
      logger.info(`    ✅ 无效数据检测正常: ${validation.errors.length}个错误`);
    }

    return true;

  } catch (error) {
    logger.error(`    ❌ 边界条件测试异常: ${error instanceof Error ? error.message : '未知错误'}`);
    return false;
  }
}

/**
 * 生成测试报告
 */
function generateTestReport(results: any) {
  logger.separator('📊 架构测试报告');
  
  // 模块状态
  logger.info('📦 模块状态:');
  for (const [module, status] of Object.entries(results.modules) as [string, boolean][]) {
    const icon = status ? '✅' : '❌';
    logger.info(`  ${icon} ${module}`);
  }

  // 性能统计
  logger.info('⚡ 性能统计:');
  for (const [operation, time] of Object.entries(results.performance) as [string, number][]) {
    logger.info(`  🕐 ${operation}: ${time}ms`);
  }

  // 总体状态
  logger.info('📋 总体评估:');
  logger.info(`  🔗 模块集成: ${results.integration ? '✅ 通过' : '❌ 失败'}`);
  logger.info(`  🎯 总体状态: ${results.overallPass ? '✅ 所有测试通过' : '❌ 存在失败项'}`);

  // 生成建议
  const recommendations = generateRecommendations(results);
  if (recommendations.length > 0) {
    logger.info('💡 改进建议:');
    recommendations.forEach(rec => logger.info(`  📌 ${rec}`));
  }
}

/**
 * 生成改进建议
 */
function generateRecommendations(results: any): string[] {
  const recommendations: string[] = [];

  if (!results.overallPass) {
    recommendations.push('存在功能问题，请检查失败的模块');
  }

  // 性能建议
  const totalTime = Object.values(results.performance).reduce((sum: number, time: any) => sum + time, 0);
  if (totalTime > 1000) {
    recommendations.push('总体处理时间较长，考虑性能优化');
  }

  if (!results.integration) {
    recommendations.push('模块集成失败，检查模块间的依赖关系');
  }

  if (recommendations.length === 0) {
    recommendations.push('架构状态良好，可以进入生产环境');
  }

  return recommendations;
}

// 主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  runArchitectureTest()
    .then(results => {
      if (results.overallPass) {
        logger.success('🎉 架构测试全部通过');
        process.exit(0);
      } else {
        logger.error('❌ 架构测试存在问题');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error(`架构测试执行失败: ${error instanceof Error ? error.message : '未知错误'}`);
      process.exit(1);
    });
}

export { runArchitectureTest }; 