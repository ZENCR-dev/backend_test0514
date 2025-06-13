#!/usr/bin/env tsx

async function runTest() {
  console.log('=== 简单模块测试 ===');

  try {
    // 1. 测试拼音生成
    console.log('1. 测试拼音生成...');
    const { PinyinGenerator } = await import('./modules/pinyin-generator.js');
    const pinyinGen = new PinyinGenerator();
    
    const pinyinTest = pinyinGen.generatePinyin('五倍子');
    console.log(`   五倍子 → ${pinyinTest.pinyin} (${pinyinTest.method})`);
    
    // 2. 测试SKU生成  
    console.log('2. 测试SKU生成...');
    const { SkuGenerator } = await import('./modules/sku-generator.js');
    const skuGen = new SkuGenerator();
    
    const skuTest = skuGen.generateSku('五倍子', 'wubeizi');
    console.log(`   五倍子 → ${skuTest.sku} (${skuTest.method})`);
    
    // 3. 测试数据验证
    console.log('3. 测试数据验证...');
    const { DataValidator } = await import('./modules/data-validator.js');
    const validator = new DataValidator();
    
    const testData = [{
      chineseName: '当归',
      englishName: 'Angelica sinensis', 
      pricePerGram: 0.85
    }];
    
    const validation = validator.validateInputData(testData);
    console.log(`   验证结果: ${validation.isValid ? '通过' : '失败'} (${validation.summary.valid}/${validation.summary.total})`);
    
    console.log('✅ 所有测试通过');
    
  } catch (error) {
    console.error('❌ 测试失败:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

runTest(); 