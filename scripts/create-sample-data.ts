#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './utils/logger.js';

/**
 * 样本数据生成器
 * 创建标准的TSV测试数据文件，供端口测试使用
 */

/**
 * 预定义的高质量中药数据
 * 包含常见中药及其标准英文名和市场价格
 */
const SAMPLE_MEDICINES = [
  { chinese: '当归', english: 'Angelica sinensis', price: 0.85 },
  { chinese: '川芎', english: 'Ligusticum chuanxiong', price: 0.92 },
  { chinese: '白芍', english: 'Paeonia lactiflora', price: 1.15 },
  { chinese: '熟地黄', english: 'Rehmannia glutinosa', price: 0.78 },
  { chinese: '人参', english: 'Panax ginseng', price: 15.50 },
  { chinese: '党参', english: 'Codonopsis pilosula', price: 1.25 },
  { chinese: '黄芪', english: 'Astragalus membranaceus', price: 0.65 },
  { chinese: '甘草', english: 'Glycyrrhiza uralensis', price: 0.45 },
  { chinese: '陈皮', english: 'Citrus reticulata', price: 0.55 },
  { chinese: '半夏', english: 'Pinellia ternata', price: 1.80 },
  { chinese: '茯苓', english: 'Poria cocos', price: 0.70 },
  { chinese: '白术', english: 'Atractylodes macrocephala', price: 1.10 },
  { chinese: '薄荷', english: 'Mentha haplocalyx', price: 0.35 },
  { chinese: '厚朴', english: 'Magnolia officinalis', price: 0.88 },
  { chinese: '杜仲', english: 'Eucommia ulmoides', price: 1.45 },
  { chinese: '枸杞子', english: 'Lycium barbarum', price: 2.20 },
  { chinese: '牛膝', english: 'Achyranthes bidentata', price: 0.75 },
  { chinese: '车前子', english: 'Plantago asiatica', price: 0.95 },
  { chinese: '知母', english: 'Anemarrhena asphodeloides', price: 1.05 },
  { chinese: '浙贝母', english: 'Fritillaria thunbergii', price: 8.50 },
  { chinese: '川贝母', english: 'Fritillaria cirrhosa', price: 25.00 },
  { chinese: '藏红花', english: 'Crocus sativus', price: 45.00 },
  { chinese: '番泻叶', english: 'Cassia angustifolia', price: 0.30 },
  { chinese: '诃子', english: 'Terminalia chebula', price: 0.85 },
  { chinese: '没药', english: 'Commiphora myrrha', price: 3.20 },
  { chinese: '乳香', english: 'Boswellia carterii', price: 2.80 },
  { chinese: '血竭', english: 'Daemonorops draco', price: 12.50 },
  { chinese: '阿胶', english: 'Equus asinus', price: 18.00 },
  { chinese: '龟板', english: 'Chinemys reevesii', price: 6.50 },
  { chinese: '鳖甲', english: 'Trionyx sinensis', price: 4.20 },
  { chinese: '蛤蚧', english: 'Gekko gecko', price: 15.80 },
  { chinese: '海马', english: 'Hippocampus kelloggii', price: 22.00 },
  { chinese: '石决明', english: 'Haliotis diversicolor', price: 1.15 },
  { chinese: '夜明砂', english: 'Vespertilio superans', price: 2.40 },
  { chinese: '五倍子', english: 'Rhus chinensis', price: 1.20 },
  { chinese: '五加皮', english: 'Acanthopanax gracilistylus', price: 0.95 },
  { chinese: '五味子', english: 'Schisandra chinensis', price: 3.50 },
  { chinese: '五指毛桃', english: 'Ficus hirta', price: 0.65 },
  { chinese: '仙茅', english: 'Curculigo orchioides', price: 2.10 },
  { chinese: '佛手', english: 'Citrus medica', price: 1.85 },
  { chinese: '金银花', english: 'Lonicera japonica', price: 1.75 },
  { chinese: '连翘', english: 'Forsythia suspensa', price: 1.25 },
  { chinese: '板蓝根', english: 'Isatis tinctoria', price: 0.85 },
  { chinese: '大青叶', english: 'Isatis indigotica', price: 0.45 },
  { chinese: '蒲公英', english: 'Taraxacum mongolicum', price: 0.55 },
  { chinese: '紫花地丁', english: 'Viola philippica', price: 0.75 },
  { chinese: '野菊花', english: 'Chrysanthemum indicum', price: 0.65 },
  { chinese: '夏枯草', english: 'Prunella vulgaris', price: 0.50 },
  { chinese: '决明子', english: 'Cassia obtusifolia', price: 0.40 },
  { chinese: '菊花', english: 'Chrysanthemum morifolium', price: 1.95 }
];

/**
 * 创建小型测试样本（10条记录）
 */
function createSmallSample(): string {
  const sample = SAMPLE_MEDICINES.slice(0, 10);
  return generateTsvContent(sample);
}

/**
 * 创建中型测试样本（25条记录）
 */
function createMediumSample(): string {
  const sample = SAMPLE_MEDICINES.slice(0, 25);
  return generateTsvContent(sample);
}

/**
 * 创建大型测试样本（所有记录）
 */
function createLargeSample(): string {
  return generateTsvContent(SAMPLE_MEDICINES);
}

/**
 * 创建包含错误数据的测试样本
 */
function createErrorSample(): string {
  const errorData = [
    { chinese: '当归', english: 'Angelica sinensis', price: 0.85 }, // 正常
    { chinese: '', english: 'Empty Chinese', price: 1.20 }, // 中文名为空
    { chinese: '人参', english: '', price: 15.50 }, // 英文名为空
    { chinese: '甘草', english: 'Glycyrrhiza uralensis', price: -0.50 }, // 负价格
    { chinese: '超长中药名称'.repeat(20), english: 'Too Long', price: 1.00 }, // 过长名称
    { chinese: '五倍子', english: 'Chinese gallnut', price: 999999 }, // 价格过高
    { chinese: '正常药材', english: 'Normal medicine', price: 2.50 }, // 正常结束
  ];
  
  return generateTsvContent(errorData);
}

/**
 * 创建性能测试样本（大量重复数据）
 */
function createPerformanceSample(count: number = 100): string {
  const performanceData = [];
  
  for (let i = 0; i < count; i++) {
    const base = SAMPLE_MEDICINES[i % SAMPLE_MEDICINES.length];
    performanceData.push({
      chinese: `${base.chinese}_${i + 1}`,
      english: `${base.english} ${i + 1}`,
      price: base.price + (Math.random() * 0.1)
    });
  }
  
  return generateTsvContent(performanceData);
}

/**
 * 生成TSV内容
 */
function generateTsvContent(data: Array<{ chinese: string; english: string; price: number }>): string {
  const header = '中文名\t英文名\t价格';
  const rows = data.map(item => 
    `${item.chinese}\t${item.english}\t${item.price.toFixed(2)}`
  );
  
  return [header, ...rows].join('\n');
}

/**
 * 保存样本文件
 */
function saveSampleFile(filename: string, content: string): void {
  const outputDir = 'sample-data';
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  
  logger.success(`样本文件已创建: ${filePath}`);
  
  // 输出文件信息
  const stats = fs.statSync(filePath);
  const lines = content.split('\n').length;
  const records = lines - 1; // 减去表头
  
  logger.info(`  📄 文件大小: ${formatFileSize(stats.size)}`);
  logger.info(`  📝 记录数量: ${records}条`);
  logger.info(`  🔤 编码格式: UTF-8`);
}

/**
 * 生成所有样本文件
 */
async function generateAllSamples(): Promise<void> {
  logger.separator('📦 生成测试样本数据');
  
  try {
    // 小型样本
    logger.info('生成小型测试样本 (10条记录)...');
    const smallSample = createSmallSample();
    saveSampleFile('small-sample.tsv', smallSample);
    
    // 中型样本
    logger.info('生成中型测试样本 (25条记录)...');
    const mediumSample = createMediumSample();
    saveSampleFile('medium-sample.tsv', mediumSample);
    
    // 大型样本
    logger.info('生成大型测试样本 (50条记录)...');
    const largeSample = createLargeSample();
    saveSampleFile('large-sample.tsv', largeSample);
    
    // 错误数据样本
    logger.info('生成错误数据测试样本...');
    const errorSample = createErrorSample();
    saveSampleFile('error-sample.tsv', errorSample);
    
    // 性能测试样本
    logger.info('生成性能测试样本 (100条记录)...');
    const performanceSample = createPerformanceSample(100);
    saveSampleFile('performance-sample.tsv', performanceSample);
    
    logger.separator('✅ 样本文件生成完成');
    
    // 生成使用说明
    generateUsageGuide();
    
  } catch (error) {
    logger.error(`样本生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    throw error;
  }
}

/**
 * 生成使用说明
 */
function generateUsageGuide(): void {
  const guide = `# 药品数据测试样本使用指南

## 文件说明

### 1. small-sample.tsv (小型测试)
- **记录数量**: 10条
- **用途**: 快速功能验证
- **特点**: 包含常见中药，数据质量良好
- **适用场景**: 初始测试、功能演示

### 2. medium-sample.tsv (中型测试)
- **记录数量**: 25条
- **用途**: 标准功能测试
- **特点**: 覆盖更多药材类型
- **适用场景**: 常规开发测试、集成验证

### 3. large-sample.tsv (大型测试)
- **记录数量**: 50条
- **用途**: 全量功能测试
- **特点**: 完整的药材数据集
- **适用场景**: 完整性测试、生产环境验证

### 4. error-sample.tsv (错误数据测试)
- **记录数量**: 7条（包含各种错误）
- **用途**: 错误处理验证
- **错误类型**:
  - 空中文名
  - 空英文名
  - 负价格
  - 过长名称
  - 过高价格
- **适用场景**: 异常处理测试、边界条件验证

### 5. performance-sample.tsv (性能测试)
- **记录数量**: 100条
- **用途**: 性能压力测试
- **特点**: 大量数据，测试处理速度
- **适用场景**: 性能优化、压力测试

## 使用方法

### 基本测试流程

1. **选择合适的样本文件**
   \`\`\`bash
   # 快速测试
   npx tsx process-medicines.ts sample-data/small-sample.tsv
   
   # 标准测试
   npx tsx process-medicines.ts sample-data/medium-sample.tsv
   
   # 完整测试
   npx tsx process-medicines.ts sample-data/large-sample.tsv
   \`\`\`

2. **错误处理测试**
   \`\`\`bash
   npx tsx process-medicines.ts sample-data/error-sample.tsv
   \`\`\`

3. **性能测试**
   \`\`\`bash
   npx tsx process-medicines.ts sample-data/performance-sample.tsv
   \`\`\`

### 架构验证测试

\`\`\`bash
# 运行完整架构测试
npx tsx test-architecture.ts

# 检查所有模块状态
npx tsx test-architecture.ts --verbose
\`\`\`

### 自定义测试数据

如果需要自定义测试数据，请按以下格式创建TSV文件：

\`\`\`
中文名	英文名	价格
当归	Angelica sinensis	0.85
川芎	Ligusticum chuanxiong	0.92
\`\`\`

**注意事项**:
- 使用制表符(\\t)分隔，不是空格
- 文件编码必须是UTF-8
- 价格使用小数格式，单位为元/克
- 第一行必须是表头

## 预期输出

成功处理后，系统会生成：

1. **processed-medicines.json** - 处理后的JSON数据
2. **processed-medicines.csv** - 处理后的CSV数据
3. **processing-report.json** - 详细处理报告
4. **processing-log.txt** - 处理日志

## 验证关键指标

- ✅ 拼音生成准确率 > 95%
- ✅ SKU生成唯一性 100%
- ✅ 数据验证通过率 > 90%
- ✅ 处理速度 < 50ms/条记录
- ✅ 错误恢复机制正常

`;

  const guideFilePath = 'sample-data/README.md';
  fs.writeFileSync(guideFilePath, guide, 'utf-8');
  logger.success(`使用说明已创建: ${guideFilePath}`);
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * 命令行接口
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法: npx tsx create-sample-data.ts [选项]

选项:
  --small       仅生成小型样本
  --medium      仅生成中型样本
  --large       仅生成大型样本
  --error       仅生成错误数据样本
  --performance 仅生成性能测试样本
  --help, -h    显示帮助信息

示例:
  npx tsx create-sample-data.ts              # 生成所有样本
  npx tsx create-sample-data.ts --small      # 仅生成小型样本
  npx tsx create-sample-data.ts --error      # 仅生成错误数据样本
`);
    return;
  }

  try {
    if (args.includes('--small')) {
      const content = createSmallSample();
      saveSampleFile('small-sample.tsv', content);
    } else if (args.includes('--medium')) {
      const content = createMediumSample();
      saveSampleFile('medium-sample.tsv', content);
    } else if (args.includes('--large')) {
      const content = createLargeSample();
      saveSampleFile('large-sample.tsv', content);
    } else if (args.includes('--error')) {
      const content = createErrorSample();
      saveSampleFile('error-sample.tsv', content);
    } else if (args.includes('--performance')) {
      const content = createPerformanceSample(100);
      saveSampleFile('performance-sample.tsv', content);
    } else {
      await generateAllSamples();
    }
    
    logger.success('🎉 样本数据生成完成');
    
  } catch (error) {
    logger.error(`执行失败: ${error instanceof Error ? error.message : '未知错误'}`);
    process.exit(1);
  }
}

// 主函数执行
main();

export { 
  generateAllSamples, 
  createSmallSample, 
  createMediumSample, 
  createLargeSample, 
  createErrorSample, 
  createPerformanceSample 
}; 