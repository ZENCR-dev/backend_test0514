#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

interface MedicineToImport {
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
  metadata?: any;
  status: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  duration: number;
}

class MedicineSeedManager {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async parseExpandedCSV(filePath: string): Promise<MedicineToImport[]> {
    console.log(`📁 正在解析CSV文件: ${filePath}`);
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('CSV文件为空');
    }

    // 解析标题行
    const headerLine = lines[0];
    const headers = this.parseCSVLine(headerLine);
    
    console.log(`📋 检测到字段: ${headers.join(', ')}`);

    const medicines: MedicineToImport[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = this.parseCSVLine(line);
        
        if (values.length !== headers.length) {
          errors.push(`行 ${i + 1}: 字段数量不匹配 (期望${headers.length}，实际${values.length})`);
          continue;
        }

        const medicine: MedicineToImport = {
          name: values[headers.indexOf('name')] || '',
          chineseName: values[headers.indexOf('chineseName')] || '',
          englishName: values[headers.indexOf('englishName')] || '',
          pinyinName: values[headers.indexOf('pinyinName')] || '',
          sku: values[headers.indexOf('sku')] || '',
          description: values[headers.indexOf('description')] || '',
          category: values[headers.indexOf('category')] || '其他中药',
          unit: values[headers.indexOf('unit')] || '克',
          requiresPrescription: values[headers.indexOf('requiresPrescription')] === 'true',
          basePrice: parseFloat(values[headers.indexOf('basePrice')] || '0'),
          status: values[headers.indexOf('status')] || 'active'
        };

        // 解析metadata（如果存在）
        const metadataIndex = headers.indexOf('metadata');
        if (metadataIndex >= 0 && values[metadataIndex]) {
          try {
            medicine.metadata = JSON.parse(values[metadataIndex]);
          } catch {
            medicine.metadata = { raw: values[metadataIndex] };
          }
        }

        // 基础验证
        if (!medicine.name || !medicine.chineseName || !medicine.sku) {
          errors.push(`行 ${i + 1}: 缺少必需字段 (name, chineseName, sku)`);
          continue;
        }

        if (medicine.basePrice <= 0) {
          errors.push(`行 ${i + 1}: 价格必须大于0 (当前: ${medicine.basePrice})`);
          continue;
        }

        medicines.push(medicine);

      } catch (error) {
        errors.push(`行 ${i + 1}: 解析错误 - ${error.message}`);
      }
    }

    if (errors.length > 0) {
      console.warn('⚠️  解析警告:');
      errors.slice(0, 10).forEach(error => console.warn(`   ${error}`));
      if (errors.length > 10) {
        console.warn(`   ... 还有 ${errors.length - 10} 个错误`);
      }
    }

    console.log(`✅ 成功解析 ${medicines.length} 条药品记录`);
    return medicines;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // 跳过下一个引号
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  async validateMedicines(medicines: MedicineToImport[]): Promise<string[]> {
    console.log('🔍 验证药品数据...');
    
    const errors: string[] = [];
    const skuSet = new Set<string>();
    const nameSet = new Set<string>();

    for (const [index, medicine] of medicines.entries()) {
      const prefix = `药品 ${index + 1} (${medicine.chineseName})`;

      // SKU唯一性检查
      if (skuSet.has(medicine.sku)) {
        errors.push(`${prefix}: SKU重复 - ${medicine.sku}`);
      } else {
        skuSet.add(medicine.sku);
      }

      // 名称唯一性检查
      if (nameSet.has(medicine.chineseName)) {
        errors.push(`${prefix}: 中文名重复 - ${medicine.chineseName}`);
      } else {
        nameSet.add(medicine.chineseName);
      }

      // SKU格式检查
      if (!/^TCM-[A-Z]{2}-\d{3}$/.test(medicine.sku)) {
        errors.push(`${prefix}: SKU格式不正确 - ${medicine.sku}`);
      }

      // 价格范围检查
      if (medicine.basePrice > 100) {
        errors.push(`${prefix}: 价格异常高 - ¥${medicine.basePrice}/克`);
      }

      // 必需字段检查
      if (!medicine.name.trim() || !medicine.chineseName.trim()) {
        errors.push(`${prefix}: 名称字段不能为空`);
      }
    }

    if (errors.length === 0) {
      console.log('✅ 数据验证通过');
    } else {
      console.warn(`⚠️  发现 ${errors.length} 个验证问题`);
    }

    return errors;
  }

  async checkExistingData(): Promise<{ count: number; sampleSKUs: string[] }> {
    console.log('🔍 检查现有数据...');
    
    const existingCount = await this.prisma.medicine.count();
    const sampleRecords = await this.prisma.medicine.findMany({
      select: { sku: true },
      take: 5
    });

    console.log(`📊 当前数据库中有 ${existingCount} 条药品记录`);
    
    return {
      count: existingCount,
      sampleSKUs: sampleRecords.map(r => r.sku)
    };
  }

  async backupExistingData(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = 'data/backups';
    const backupFile = path.join(backupDir, `medicines-backup-${timestamp}.json`);

    // 确保备份目录存在
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log('💾 备份现有数据...');
    
    const existingMedicines = await this.prisma.medicine.findMany();
    fs.writeFileSync(backupFile, JSON.stringify(existingMedicines, null, 2));
    
    console.log(`✅ 备份完成: ${backupFile} (${existingMedicines.length} 条记录)`);
    
    return backupFile;
  }

  async importMedicines(
    medicines: MedicineToImport[], 
    mode: 'reset' | 'upsert' = 'upsert'
  ): Promise<ImportResult> {
    const startTime = Date.now();
    console.log(`🚀 开始导入 ${medicines.length} 条药品记录 (模式: ${mode})`);

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      // 重置模式：清空现有数据
      if (mode === 'reset') {
        console.log('🗑️  清空现有药品数据...');
        const deleteResult = await this.prisma.medicine.deleteMany();
        console.log(`   删除了 ${deleteResult.count} 条记录`);
      }

      // 批量导入 - 每个批次使用独立事务
      const batchSize = 10; // 减少批次大小
      const batches = [];
      
      for (let i = 0; i < medicines.length; i += batchSize) {
        batches.push(medicines.slice(i, i + batchSize));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`   批次 ${batchIndex + 1}/${batches.length}: 处理 ${batch.length} 条记录`);

        // 每个批次使用独立的事务
        await this.prisma.$transaction(async (tx) => {
          for (const medicine of batch) {
            try {
              if (mode === 'upsert') {
                await tx.medicine.upsert({
                  where: { sku: medicine.sku },
                  update: {
                    name: medicine.name,
                    chineseName: medicine.chineseName,
                    englishName: medicine.englishName,
                    pinyinName: medicine.pinyinName,
                    description: medicine.description,
                    category: medicine.category,
                    unit: medicine.unit,
                    requiresPrescription: medicine.requiresPrescription,
                    basePrice: medicine.basePrice,
                    metadata: medicine.metadata,
                    status: medicine.status,
                    updatedAt: new Date()
                  },
                  create: {
                    name: medicine.name,
                    chineseName: medicine.chineseName,
                    englishName: medicine.englishName,
                    pinyinName: medicine.pinyinName,
                    sku: medicine.sku,
                    description: medicine.description,
                    category: medicine.category,
                    unit: medicine.unit,
                    requiresPrescription: medicine.requiresPrescription,
                    basePrice: medicine.basePrice,
                    metadata: medicine.metadata,
                    status: medicine.status
                  }
                });
              } else {
                await tx.medicine.create({
                  data: {
                    name: medicine.name,
                    chineseName: medicine.chineseName,
                    englishName: medicine.englishName,
                    pinyinName: medicine.pinyinName,
                    sku: medicine.sku,
                    description: medicine.description,
                    category: medicine.category,
                    unit: medicine.unit,
                    requiresPrescription: medicine.requiresPrescription,
                    basePrice: medicine.basePrice,
                    metadata: medicine.metadata,
                    status: medicine.status
                  }
                });
              }
              imported++;
              console.log(`     ✅ ${medicine.chineseName}`);
            } catch (error) {
              failed++;
              const errorMsg = `${medicine.chineseName} (${medicine.sku}): ${error.message}`;
              errors.push(errorMsg);
              console.error(`     ❌ ${errorMsg}`);
            }
          }
        }, {
          timeout: 20000 // 20秒超时
        });
      }

      const duration = Date.now() - startTime;
      console.log(`✅ 导入完成! 成功: ${imported}, 失败: ${failed}, 耗时: ${duration}ms`);

      return {
        success: true,
        imported,
        failed,
        errors,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('❌ 导入失败:', error);
      
      return {
        success: false,
        imported: 0,
        failed: medicines.length,
        errors: [error.message],
        duration
      };
    }
  }

  async generateReport(result: ImportResult): Promise<void> {
    console.log('\n📋 导入报告');
    console.log('=================');
    console.log(`状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`导入成功: ${result.imported} 条`);
    console.log(`导入失败: ${result.failed} 条`);
    console.log(`耗时: ${result.duration}ms`);

    if (result.errors.length > 0) {
      console.log('\n❌ 错误详情:');
      result.errors.slice(0, 10).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      if (result.errors.length > 10) {
        console.log(`   ... 还有 ${result.errors.length - 10} 个错误`);
      }
    }

    // 验证导入结果
    const finalCount = await this.prisma.medicine.count();
    console.log(`\n📊 当前数据库状态: ${finalCount} 条药品记录`);

    // 生成样本查询
    const samples = await this.prisma.medicine.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        chineseName: true,
        sku: true,
        category: true,
        basePrice: true
      }
    });

    if (samples.length > 0) {
      console.log('\n🔍 最新导入的药品样本:');
      samples.forEach((sample, index) => {
        console.log(`   ${index + 1}. ${sample.chineseName} (${sample.sku}) - ${sample.category} - ¥${sample.basePrice}/克`);
      });
    }
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

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const inputFile = args.find(arg => arg.startsWith('--input='))?.split('=')[1] || 'data/expanded/medicines-complete.csv';
  const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] as 'reset' | 'upsert' || 'upsert';
  const validateOnly = args.includes('--validate-only');
  const skipConfirm = args.includes('--yes');
  const backup = !args.includes('--no-backup');

  console.log('🏥 中药数据库导入工具');
  console.log('========================\n');

  const seedManager = new MedicineSeedManager();

  try {
    // 检查输入文件
    if (!fs.existsSync(inputFile)) {
      console.error(`❌ 输入文件不存在: ${inputFile}`);
      console.log('\n💡 请先运行AI扩展工具:');
      console.log('   npx tsx scripts/expand-medicines-ai.ts --input=data/user-input/medicines-raw.csv');
      return;
    }

    // 解析CSV文件
    const medicines = await seedManager.parseExpandedCSV(inputFile);

    // 验证数据
    const validationErrors = await seedManager.validateMedicines(medicines);
    
    if (validationErrors.length > 0) {
      console.error('\n❌ 数据验证失败:');
      validationErrors.slice(0, 10).forEach(error => console.error(`   ${error}`));
      if (validationErrors.length > 10) {
        console.error(`   ... 还有 ${validationErrors.length - 10} 个错误`);
      }
      
      if (!skipConfirm) {
        const proceed = await seedManager.confirmProceed('⚠️  是否继续导入 (可能导致数据问题)?');
        if (!proceed) {
          console.log('❌ 用户取消操作');
          return;
        }
      }
    }

    if (validateOnly) {
      console.log('👀 仅验证模式，不执行导入');
      return;
    }

    // 检查现有数据
    const existingData = await seedManager.checkExistingData();
    
    // 备份现有数据
    if (backup && existingData.count > 0) {
      await seedManager.backupExistingData();
    }

    // 确认导入
    if (!skipConfirm) {
      let confirmMessage = `🤔 是否导入 ${medicines.length} 条药品记录?`;
      if (mode === 'reset' && existingData.count > 0) {
        confirmMessage += `\n⚠️  警告: 将删除现有的 ${existingData.count} 条记录`;
      }
      
      const proceed = await seedManager.confirmProceed(confirmMessage);
      if (!proceed) {
        console.log('❌ 用户取消操作');
        return;
      }
    }

    // 执行导入
    const result = await seedManager.importMedicines(medicines, mode);

    // 生成报告
    await seedManager.generateReport(result);

    console.log('\n🚀 下一步建议:');
    console.log('1. 测试API查询: GET /medicines?search=当归');
    console.log('2. 检查数据完整性');
    console.log('3. 运行单元测试验证功能');

  } catch (error) {
    console.error('❌ 处理失败:', error);
    process.exit(1);
  } finally {
    await seedManager.disconnect();
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

export { MedicineSeedManager, type MedicineToImport, type ImportResult };