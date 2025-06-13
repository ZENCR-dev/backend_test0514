#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// 基础拼音映射
const pinyinMap: Record<string, string> = {
  '当': 'dang',
  '归': 'gui',
  '川': 'chuan',
  '芎': 'xiong',
  '白': 'bai',
  '芍': 'shao',
  '熟': 'shu',
  '地': 'di',
  '黄': 'huang',
  '人': 'ren',
  '参': 'shen',
  '党': 'dang',
  '甘': 'gan',
  '草': 'cao',
  '陈': 'chen',
  '皮': 'pi',
  '半': 'ban',
  '夏': 'xia',
  '茯': 'fu',
  '苓': 'ling',
  '术': 'zhu'
};

// 基础英文名映射
const englishNameMap: Record<string, string> = {
  '当归': 'Angelica sinensis',
  '川芎': 'Ligusticum chuanxiong',
  '白芍': 'Paeonia lactiflora',
  '熟地黄': 'Rehmannia glutinosa',
  '人参': 'Panax ginseng',
  '黄芪': 'Astragalus membranaceus',
  '党参': 'Codonopsis pilosula',
  '甘草': 'Glycyrrhiza uralensis',
  '陈皮': 'Citrus reticulata',
  '半夏': 'Pinellia ternata',
  '茯苓': 'Poria cocos',
  '白术': 'Atractylodes macrocephala'
};

// 药品分类映射
const categoryMap: Record<string, string> = {
  '当归': '补血药',
  '川芎': '活血化瘀药',
  '白芍': '补血药',
  '熟地黄': '补血药',
  '人参': '补气药',
  '黄芪': '补气药',
  '党参': '补气药',
  '甘草': '补气药',
  '陈皮': '理气药',
  '半夏': '化痰止咳平喘药',
  '茯苓': '利水渗湿药',
  '白术': '补气药'
};

interface RawMedicineData {
  chineseName: string;
  pricePerGram: number;
}

interface ExpandedMedicineData {
  name: string;
  chineseName: string;
  englishName: string;
  pinyinName: string;
  sku: string;
  description: string;
  category: string;
  unit: string;
  requiresPrescription: boolean;
  basePrice: number;
  metadata: any;
  status: string;
}

class MedicineDataExpander {
  private generatePinyin(chineseName: string): string {
    // 简单的拼音生成：取最后一个字的拼音
    const lastChar = chineseName.slice(-1);
    return pinyinMap[lastChar] || lastChar.toLowerCase();
  }

  private generateEnglishName(chineseName: string): string {
    // 检查是否有直接映射
    if (englishNameMap[chineseName]) {
      return englishNameMap[chineseName];
    }
    
    // 简单的英文名生成：取最后一个字的拼音并首字母大写
    const lastChar = chineseName.slice(-1);
    const pinyin = pinyinMap[lastChar] || lastChar;
    return pinyin.charAt(0).toUpperCase() + pinyin.slice(1);
  }

  private generateCategory(chineseName: string): string {
    // 查找预定义分类
    if (categoryMap[chineseName]) {
      return categoryMap[chineseName];
    }

    // 默认分类
    return '其他中药';
  }

  private generateSKU(chineseName: string, index: number): string {
    const lastChar = chineseName.slice(-1);
    const pinyin = pinyinMap[lastChar] || lastChar;
    const prefix = pinyin.substring(0, 2).toUpperCase();
    return `TCM-${prefix}-${(index + 1).toString().padStart(3, '0')}`;
  }

  private generateDescription(chineseName: string, category: string): string {
    const descriptions = {
      '补血药': '补血养血，适用于血虚证',
      '活血化瘀药': '活血化瘀，适用于血瘀证',
      '补气药': '补气健脾，适用于气虚证',
      '理气药': '理气和中，适用于气滞证',
      '化痰止咳平喘药': '化痰止咳，适用于痰湿咳嗽',
      '利水渗湿药': '利水渗湿，适用于水湿证',
      '其他中药': `${chineseName}，中药材`
    };

    return descriptions[category] || `${chineseName}，中药材`;
  }

  async expandMedicine(raw: RawMedicineData, index: number): Promise<ExpandedMedicineData> {
    const pinyinName = this.generatePinyin(raw.chineseName);
    const englishName = this.generateEnglishName(raw.chineseName);
    const category = this.generateCategory(raw.chineseName);
    const sku = this.generateSKU(raw.chineseName, index);
    const description = this.generateDescription(raw.chineseName, category);

    return {
      name: raw.chineseName,
      chineseName: raw.chineseName,
      englishName: englishName,
      pinyinName: pinyinName,
      sku: sku,
      description: description,
      category: category,
      unit: '克',
      requiresPrescription: true,
      basePrice: raw.pricePerGram,
      metadata: {},
      status: 'active'
    };
  }

  async parseRawCSV(filePath: string): Promise<RawMedicineData[]> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const medicines: RawMedicineData[] = [];
    let isFirstLine = true;

    for await (const line of rl) {
      if (isFirstLine) {
        isFirstLine = false;
        continue; // 跳过表头
      }

      if (line.trim()) {
        const [chineseName, priceStr] = line.split(',');
        
        if (chineseName && priceStr) {
          const pricePerGram = parseFloat(priceStr.trim());
          
          if (!isNaN(pricePerGram)) {
            medicines.push({
              chineseName: chineseName.trim(),
              pricePerGram: pricePerGram
            });
          }
        }
      }
    }

    return medicines;
  }

  async generateCompleteCSV(expandedData: ExpandedMedicineData[], outputPath: string): Promise<void> {
    const headers = [
      'name', 'chineseName', 'englishName', 'pinyinName', 'sku', 
      'description', 'category', 'unit', 'requiresPrescription', 
      'basePrice', 'metadata', 'status'
    ];

    const escapeCSVField = (field: string): string => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvContent = [
      headers.join(','),
      ...expandedData.map(item => [
        escapeCSVField(item.name),
        escapeCSVField(item.chineseName),
        escapeCSVField(item.englishName),
        escapeCSVField(item.pinyinName),
        escapeCSVField(item.sku),
        escapeCSVField(item.description),
        escapeCSVField(item.category),
        escapeCSVField(item.unit),
        item.requiresPrescription.toString(),
        item.basePrice.toString(),
        escapeCSVField(JSON.stringify(item.metadata)),
        escapeCSVField(item.status)
      ].join(','))
    ].join('\n');

    await fs.promises.writeFile(outputPath, csvContent, 'utf8');
    console.log(`✅ 完整CSV已生成: ${outputPath}`);
  }

  async showPreview(expandedData: ExpandedMedicineData[], sampleSize: number = 10): Promise<void> {
    console.log('\n📋 AI扩展结果预览：\n');
    
    const sample = expandedData.slice(0, sampleSize);
    sample.forEach((item, index) => {
      console.log(`${index + 1}. ${item.chineseName} (${item.pinyinName})`);
      console.log(`   英文名: ${item.englishName}`);
      console.log(`   分类: ${item.category}`);
      console.log(`   SKU: ${item.sku}`);
      console.log(`   价格: ¥${item.basePrice}/克`);
      console.log(`   描述: ${item.description}\n`);
    });

    if (expandedData.length > sampleSize) {
      console.log(`... 还有 ${expandedData.length - sampleSize} 条记录\n`);
    }
  }

  async showStatistics(expandedData: ExpandedMedicineData[]): Promise<void> {
    console.log('\n📊 数据统计：');
    console.log(`总记录数: ${expandedData.length}`);
    
    // 按分类统计
    const categoryStats: Record<string, number> = {};
    expandedData.forEach(item => {
      categoryStats[item.category] = (categoryStats[item.category] || 0) + 1;
    });

    console.log('\n按分类统计:');
    Object.entries(categoryStats)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`  ${category}: ${count} 种`);
      });

    // 价格统计
    const prices = expandedData.map(item => item.basePrice);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    console.log('\n价格统计:');
    console.log(`  平均价格: ¥${avgPrice.toFixed(4)}/克`);
    console.log(`  最低价格: ¥${minPrice}/克`);
    console.log(`  最高价格: ¥${maxPrice}/克`);
  }

  async confirmProceed(message: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(`${message} (y/N): `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }
}

async function main() {
  try {
    const inputFile = path.join(__dirname, '../scripts/data/medicines_unique_clean.csv');
    const outputFile = path.join(__dirname, '../scripts/data/medicines_expanded.csv');

    console.log('🔄 开始中药数据AI扩展...\n');

    const expander = new MedicineDataExpander();
    
    // 解析原始CSV
    console.log('📖 读取原始数据...');
    const rawData = await expander.parseRawCSV(inputFile);
    console.log(`✅ 成功读取 ${rawData.length} 条原始记录\n`);

    // AI扩展数据
    console.log('🤖 开始AI扩展处理...');
    const expandedData: ExpandedMedicineData[] = [];
    
    for (let i = 0; i < rawData.length; i++) {
      const expanded = await expander.expandMedicine(rawData[i], i);
      expandedData.push(expanded);
      
      if ((i + 1) % 50 === 0) {
        console.log(`处理进度: ${i + 1}/${rawData.length}`);
      }
    }

    console.log(`✅ AI扩展完成，共处理 ${expandedData.length} 条记录\n`);

    // 显示预览
    await expander.showPreview(expandedData);
    
    // 显示统计
    await expander.showStatistics(expandedData);

    // 确认保存
    const shouldSave = await expander.confirmProceed('\n💾 是否保存完整的扩展数据到CSV文件？');
    
    if (shouldSave) {
      await expander.generateCompleteCSV(expandedData, outputFile);
      console.log('\n🎉 AI扩展完成！');
    } else {
      console.log('\n❌ 已取消保存');
    }

  } catch (error) {
    console.error('❌ 执行失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { MedicineDataExpander, type RawMedicineData, type ExpandedMedicineData };