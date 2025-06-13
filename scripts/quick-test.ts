#!/usr/bin/env tsx

import { PinyinGenerator } from './modules/pinyin-generator.js';
import { SkuGenerator } from './modules/sku-generator.js';
import { logger } from './utils/logger.js';

/**
 * 快速功能测试
 */
async function quickTest() {
  logger.separator('🧪 快速功能测试');
  
  try {
    // 测试拼音生成
    logger.info('测试拼音生成器...');
    const pinyinGenerator = new PinyinGenerator();
    
    const testCases = ['五倍子', '当归', '人参', '甘草'];
    for (const name of testCases) {
      const result = pinyinGenerator.generatePinyin(name);
      logger.info(`  ${name} → ${result.pinyin} (${result.method})`);
    }
    
    // 测试SKU生成
    logger.info('测试SKU生成器...');
    const skuGenerator = new SkuGenerator();
    
    for (const name of testCases) {
      const pinyinResult = pinyinGenerator.generatePinyin(name);
      const skuResult = skuGenerator.generateSku(name, pinyinResult.pinyin);
      logger.info(`  ${name} → ${skuResult.sku} (${skuResult.method})`);
    }
    
    logger.success('✅ 快速测试完成');
    
  } catch (error) {
    logger.error(`❌ 测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
    throw error;
  }
}

// 执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  quickTest().catch(error => {
    console.error(error);
    process.exit(1);
  });
} 