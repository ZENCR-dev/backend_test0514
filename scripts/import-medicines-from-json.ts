#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface ProcessedMedicine {
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

interface ProcessedData {
  metadata: {
    processedAt: string;
    inputFile: string;
    totalRecords: number;
    version: string;
  };
  medicines: ProcessedMedicine[];
}

class MedicineImporter {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async importFromJson(jsonFilePath: string): Promise<void> {
    try {
      console.log('🚀 开始导入药品数据到Supabase数据库...');
      
      // 读取JSON文件
      const fullPath = resolve(process.cwd(), jsonFilePath);
      console.log(`📁 读取文件: ${fullPath}`);
      
      const jsonContent = readFileSync(fullPath, 'utf-8');
      const data: ProcessedData = JSON.parse(jsonContent);
      
      console.log(`📊 文件包含 ${data.medicines.length} 条药品记录`);
      console.log(`📅 处理时间: ${data.metadata.processedAt}`);
      console.log(`📝 原始文件: ${data.metadata.inputFile}`);
      
      // 清空现有数据（可选）
      console.log('🗑️  清空现有药品数据...');
      await this.prisma.medicine.deleteMany({});
      console.log('✅ 现有数据已清空');
      
      // 批量导入数据
      console.log('📥 开始批量导入...');
      let imported = 0;
      
      for (const medicine of data.medicines) {
        try {
          await this.prisma.medicine.create({
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
              status: medicine.status,
            }
          });
          imported++;
          
          if (imported % 10 === 0) {
            console.log(`📥 已导入 ${imported}/${data.medicines.length} 条记录...`);
          }
        } catch (error) {
          console.error(`❌ 导入失败: ${medicine.chineseName}`, error);
        }
      }
      
      console.log(`✅ 导入完成！总共导入 ${imported} 条记录`);
      
      // 验证导入结果
      await this.verifyImport(data.medicines.length);
      
    } catch (error) {
      console.error('❌ 导入过程发生错误:', error);
      throw error;
    }
  }

  private async verifyImport(expectedCount: number): Promise<void> {
    console.log('🔍 验证导入结果...');
    
    const totalCount = await this.prisma.medicine.count();
    console.log(`📊 数据库中药品总数: ${totalCount}`);
    
    if (totalCount === expectedCount) {
      console.log('✅ 导入验证成功！数量匹配');
    } else {
      console.log(`⚠️  导入验证警告: 期望 ${expectedCount} 条，实际 ${totalCount} 条`);
    }
    
    // 显示一些样本数据
    const samples = await this.prisma.medicine.findMany({
      select: {
        chineseName: true,
        sku: true,
        basePrice: true,
        category: true,
      },
      take: 5
    });
    
    console.log('📋 样本数据:');
    samples.forEach(sample => {
      console.log(`   - ${sample.chineseName} (${sample.sku}) - ¥${sample.basePrice} - ${sample.category}`);
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ 请提供JSON文件路径');
    console.log('使用方法: npx tsx scripts/import-medicines-from-json.ts <json-file-path>');
    console.log('示例: npx tsx scripts/import-medicines-from-json.ts output/medicine-data-template-detailed.json');
    process.exit(1);
  }
  
  const jsonFilePath = args[0];
  const importer = new MedicineImporter();
  
  try {
    await importer.importFromJson(jsonFilePath);
    console.log('🎉 药品数据导入完成！');
  } catch (error) {
    console.error('💥 导入失败:', error);
    process.exit(1);
  } finally {
    await importer.disconnect();
  }
}

if (require.main === module) {
  main();
} 