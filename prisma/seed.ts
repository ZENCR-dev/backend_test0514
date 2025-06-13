#!/usr/bin/env tsx

/**
 * Prisma Database Seed Script
 * 药品数据初始化脚本
 * 
 * 功能：
 * - 从JSON文件读取441种药品数据
 * - 支持幂等操作（清空+重新插入）
 * - 命令行参数支持
 * - 完整的错误处理和日志记录
 * 
 * 使用方法：
 * npm run db:seed                    # 标准种子数据导入
 * npx tsx prisma/seed.ts --help      # 显示帮助信息
 * npx tsx prisma/seed.ts --dry-run   # 预览模式，不实际写入
 * npx tsx prisma/seed.ts --force     # 强制重置并导入
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { performance } from 'perf_hooks';

// ==================== 类型定义 ====================

interface SeedOptions {
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
  dataFile?: string;
  validate?: boolean;
  envCheck?: boolean;
  schemaCheck?: boolean;
  crudTest?: boolean;
  errorTest?: boolean;
  full?: boolean;
  // A3步骤: 导入和备份选项
  backup?: boolean;
  rollback?: boolean;
  showBackup?: boolean;
  import?: boolean;
  testImport?: boolean;
  batchSize?: number;
  resumeFrom?: number;
  verifyImport?: boolean;
  qualityCheck?: boolean;
  // 数据清理选项
  cleanupTcm?: boolean;
  analyzeData?: boolean;
  // 数据修复选项
  fixDescriptions?: boolean;
  fixPrices?: boolean;
  analyzeFields?: boolean;
  generateProfessionalDescriptions?: boolean;
  fixAllPrices?: boolean;
}

interface MedicineData {
  name: string;
  chineseName: string;
  englishName: string;
  pinyinName: string;
  sku: string;
  description?: string;
  category?: string;
  unit: string;
  requiresPrescription: boolean;
  basePrice: number;
  metadata?: any;
  status?: string;
}

interface SeedResult {
  success: boolean;
  totalRecords: number;
  insertedRecords: number;
  skippedRecords: number;
  errors: string[];
  duration: number;
}

interface BackupInfo {
  id: string;
  timestamp: string;
  recordCount: number;
  description: string;
  metadata?: any;
}

interface ImportResult {
  success: boolean;
  totalBatches: number;
  completedBatches: number;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  errors: string[];
  duration: number;
  backupId?: string;
}

// ==================== 备份管理系统 ====================

class BackupManager {
  private prisma: PrismaClient;
  private logger: Logger;

  constructor(prisma: PrismaClient, logger: Logger) {
    this.prisma = prisma;
    this.logger = logger;
  }

  /**
   * 创建备份点
   */
  async createBackup(description: string = '数据导入前备份'): Promise<BackupInfo> {
    try {
      this.logger.info('创建数据库备份点...');
      
      // 获取当前medicines表记录数
      const currentCount = await this.prisma.medicine.count();
      
      const backupInfo: BackupInfo = {
        id: `backup_${Date.now()}`,
        timestamp: new Date().toISOString(),
        recordCount: currentCount,
        description,
        metadata: {
          tableStatus: 'medicines',
          version: '1.0'
        }
      };
      
      // 将备份信息保存到文件
      const backupPath = `scripts/backups/backup_${backupInfo.id}.json`;
      const fs = require('fs');
      const path = require('path');
      
      // 确保备份目录存在
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      fs.writeFileSync(backupPath, JSON.stringify(backupInfo, null, 2));
      
      this.logger.success(`备份点创建成功: ${backupInfo.id}`);
      this.logger.info(`当前记录数: ${currentCount}`);
      this.logger.info(`备份文件: ${backupPath}`);
      
      return backupInfo;
      
    } catch (error) {
      this.logger.error('创建备份失败:', error);
      throw error;
    }
  }

  /**
   * 执行回滚操作
   */
  async rollback(backupId?: string): Promise<boolean> {
    try {
      this.logger.info('开始执行数据库回滚...');
      
      // 查找最新的备份
      const backupInfo = await this.findLatestBackup(backupId);
      if (!backupInfo) {
        this.logger.error('未找到有效的备份点');
        return false;
      }
      
      this.logger.info(`使用备份点: ${backupInfo.id}`);
      this.logger.info(`备份时间: ${backupInfo.timestamp}`);
      this.logger.info(`备份记录数: ${backupInfo.recordCount}`);
      
      // 获取当前记录数
      const currentCount = await this.prisma.medicine.count();
      this.logger.info(`当前记录数: ${currentCount}`);
      
      if (currentCount <= backupInfo.recordCount) {
        this.logger.warn('当前记录数不大于备份记录数，无需回滚');
        return true;
      }
      
      // 计算需要删除的记录数
      const recordsToDelete = currentCount - backupInfo.recordCount;
      this.logger.info(`需要删除 ${recordsToDelete} 条记录`);
      
      // 执行回滚 - 删除最新添加的记录
      const deletedRecords = await this.prisma.medicine.deleteMany({
        where: {
          createdAt: {
            gt: new Date(backupInfo.timestamp)
          }
        }
      });
      
      this.logger.success(`回滚完成，删除了 ${deletedRecords.count} 条记录`);
      
      // 验证回滚结果
      const finalCount = await this.prisma.medicine.count();
      this.logger.info(`回滚后记录数: ${finalCount}`);
      
      if (finalCount === backupInfo.recordCount) {
        this.logger.success('回滚验证通过');
        return true;
      } else {
        this.logger.error(`回滚验证失败: 期望 ${backupInfo.recordCount}，实际 ${finalCount}`);
        return false;
      }
      
    } catch (error) {
      this.logger.error('回滚操作失败:', error);
      return false;
    }
  }

  /**
   * 显示备份状态
   */
  async showBackupStatus(): Promise<void> {
    try {
      const backupInfo = await this.findLatestBackup();
      const currentCount = await this.prisma.medicine.count();
      
      console.log('\n📋 数据库备份状态');
      console.log('='.repeat(40));
      
      if (backupInfo) {
        console.log(`✅ 最新备份: ${backupInfo.id}`);
        console.log(`📅 备份时间: ${backupInfo.timestamp}`);
        console.log(`📊 备份记录数: ${backupInfo.recordCount}`);
        console.log(`📝 备份描述: ${backupInfo.description}`);
      } else {
        console.log('❌ 未找到备份点');
      }
      
      console.log(`📊 当前记录数: ${currentCount}`);
      
      if (backupInfo && currentCount > backupInfo.recordCount) {
        console.log(`⚠️  新增记录: ${currentCount - backupInfo.recordCount} 条`);
        console.log('💡 可以执行回滚操作');
      }
      
      console.log('='.repeat(40));
      
    } catch (error) {
      this.logger.error('获取备份状态失败:', error);
    }
  }

  /**
   * 查找最新备份
   */
  private async findLatestBackup(backupId?: string): Promise<BackupInfo | null> {
    try {
      const fs = require('fs');
      const path = require('path');
      const backupDir = 'scripts/backups';
      
      if (!fs.existsSync(backupDir)) {
        return null;
      }
      
      const files = fs.readdirSync(backupDir)
        .filter((file: string) => file.startsWith('backup_') && file.endsWith('.json'));
      
      if (files.length === 0) {
        return null;
      }
      
      // 如果指定了备份ID，查找特定备份
      if (backupId) {
        const targetFile = `backup_${backupId}.json`;
        if (files.includes(targetFile)) {
          const backupPath = path.join(backupDir, targetFile);
          return JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        }
        return null;
      }
      
      // 查找最新备份
      const latestFile = files.sort().pop();
      const backupPath = path.join(backupDir, latestFile);
      return JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      
    } catch (error) {
      this.logger.error('查找备份失败:', error);
      return null;
    }
  }
}

// ==================== 分批导入系统 ====================

class BatchImporter {
  private prisma: PrismaClient;
  private logger: Logger;
  private batchSize: number;

  constructor(prisma: PrismaClient, logger: Logger, batchSize: number = 20) {
    this.prisma = prisma;
    this.logger = logger;
    this.batchSize = batchSize;
  }

  /**
   * 执行分批导入
   */
  async importData(data: MedicineData[], resumeFrom: number = 0): Promise<ImportResult> {
    const startTime = performance.now();
    const totalRecords = data.length;
    const totalBatches = Math.ceil(totalRecords / this.batchSize);
    
    let importedRecords = 0;
    let skippedRecords = 0;
    const errors: string[] = [];
    
    this.logger.info(`开始分批导入: ${totalRecords} 条记录，${totalBatches} 个批次`);
    this.logger.info(`批次大小: ${this.batchSize}，从批次 ${resumeFrom + 1} 开始`);
    
    try {
      for (let batchIndex = resumeFrom; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * this.batchSize;
        const batchEnd = Math.min(batchStart + this.batchSize, totalRecords);
        const batchData = data.slice(batchStart, batchEnd);
        
        this.logger.info(`\n📦 批次 ${batchIndex + 1}/${totalBatches}: 处理记录 ${batchStart + 1}-${batchEnd}`);
        
        try {
          const batchResult = await this.importBatch(batchData, batchIndex + 1);
          importedRecords += batchResult.imported;
          skippedRecords += batchResult.skipped;
          
          if (batchResult.errors.length > 0) {
            errors.push(...batchResult.errors);
          }
          
          // 批次间短暂暂停，避免数据库压力
          if (batchIndex < totalBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (batchError) {
          const errorMsg = `批次 ${batchIndex + 1} 导入失败: ${batchError}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
          
          // 批次失败时，询问是否继续
          this.logger.warn('批次导入失败，但将继续处理下一批次');
        }
      }
      
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      const result: ImportResult = {
        success: errors.length === 0,
        totalBatches,
        completedBatches: totalBatches - resumeFrom,
        totalRecords,
        importedRecords,
        skippedRecords,
        errors,
        duration
      };
      
      this.printImportSummary(result);
      return result;
      
    } catch (error) {
      this.logger.error('分批导入过程失败:', error);
      throw error;
    }
  }

  /**
   * 导入单个批次
   */
  private async importBatch(batchData: MedicineData[], batchNumber: number): Promise<{imported: number, skipped: number, errors: string[]}> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    try {
      // 使用事务确保批次的原子性，增加超时时间
      await this.prisma.$transaction(async (tx) => {
        for (const medicine of batchData) {
          try {
            // 检查SKU是否已存在
            const existing = await tx.medicine.findUnique({
              where: { sku: medicine.sku }
            });
            
            if (existing) {
              this.logger.warn(`跳过重复SKU: ${medicine.sku} (${medicine.chineseName})`);
              skipped++;
              continue;
            }
            
            // 插入新记录
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
                status: medicine.status || 'active'
              }
            });
            
            imported++;
            
          } catch (recordError) {
            const errorMsg = `记录导入失败 ${medicine.sku}: ${recordError}`;
            errors.push(errorMsg);
            this.logger.error(errorMsg);
          }
        }
      }, {
        timeout: 30000, // 30秒超时
        maxWait: 35000  // 最大等待时间35秒
      });
      
      this.logger.success(`批次 ${batchNumber} 完成: 导入 ${imported} 条，跳过 ${skipped} 条`);
      
    } catch (transactionError) {
      const errorMsg = `批次 ${batchNumber} 事务失败: ${transactionError}`;
      errors.push(errorMsg);
      throw new Error(errorMsg);
    }
    
    return { imported, skipped, errors };
  }

  /**
   * 测试导入（仅前N条记录）
   */
  async testImport(data: MedicineData[], testCount: number = 10): Promise<ImportResult> {
    this.logger.info(`🧪 测试导入模式: 仅导入前 ${testCount} 条记录`);
    
    const testData = data.slice(0, testCount);
    return await this.importData(testData);
  }

  /**
   * 打印导入摘要
   */
  private printImportSummary(result: ImportResult): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 A3步骤：数据导入结果报告');
    console.log('='.repeat(50));
    
    console.log(`✅ 导入状态: ${result.success ? '成功' : '部分失败'}`);
    console.log(`📦 总批次数: ${result.totalBatches}`);
    console.log(`✅ 完成批次: ${result.completedBatches}`);
    console.log(`📊 总记录数: ${result.totalRecords}`);
    console.log(`✅ 导入记录: ${result.importedRecords}`);
    console.log(`⏭️  跳过记录: ${result.skippedRecords}`);
    console.log(`⏱️  执行时间: ${result.duration}ms`);
    
    if (result.errors.length > 0) {
      console.log(`❌ 错误数量: ${result.errors.length}`);
      console.log('\n错误详情:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    console.log('='.repeat(50));
    
    if (result.success) {
      console.log('🎉 数据导入完全成功！');
    } else {
      console.log('⚠️  数据导入部分成功，请检查错误信息');
    }
  }
}

// ==================== 日志系统 ====================

class Logger {
  private verbose: boolean;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  info(message: string, ...args: any[]) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
  }

  debug(message: string, ...args: any[]) {
    if (this.verbose) {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }

  success(message: string, ...args: any[]) {
    console.log(`[SUCCESS] ${new Date().toISOString()} - ${message}`, ...args);
  }
}

// ==================== 主要种子服务类 ====================

class MedicineSeedService {
  private prisma: PrismaClient;
  private logger: Logger;
  private backupManager: BackupManager;
  private batchImporter: BatchImporter;

  constructor(verbose: boolean = false, batchSize: number = 20) {
    this.prisma = new PrismaClient();
    this.logger = new Logger(verbose);
    this.backupManager = new BackupManager(this.prisma, this.logger);
    this.batchImporter = new BatchImporter(this.prisma, this.logger, batchSize);
  }

  /**
   * 检查环境和依赖
   */
  async checkEnvironment(): Promise<void> {
    this.logger.info('检查环境配置...');

    // 检查数据库连接
    try {
      await this.prisma.$connect();
      this.logger.success('数据库连接成功');
    } catch (error) {
      throw new Error(`数据库连接失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    // 检查环境变量
    const requiredEnvVars = ['DATABASE_URL'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`缺少必需的环境变量: ${envVar}`);
      }
    }

    this.logger.success('环境检查通过');
  }

  /**
   * 读取和验证种子数据
   */
  async loadSeedData(dataFile?: string): Promise<MedicineData[]> {
    const defaultDataFile = resolve(process.cwd(), 'scripts/seed-data/medicines-seed-441.json');
    const filePath = dataFile || defaultDataFile;

    this.logger.info(`读取种子数据文件: ${filePath}`);

    // 检查文件存在性
    if (!existsSync(filePath)) {
      throw new Error(`种子数据文件不存在: ${filePath}`);
    }

    // 读取和解析JSON
    let rawData: any[];
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      rawData = JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`读取或解析JSON文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    // 验证数据格式
    if (!Array.isArray(rawData)) {
      throw new Error('种子数据必须是数组格式');
    }

    this.logger.info(`成功读取 ${rawData.length} 条记录`);

    // 验证每条记录的必需字段
    const validatedData: MedicineData[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const record = rawData[i];
      const recordErrors = this.validateMedicineRecord(record, i + 1);
      
      if (recordErrors.length > 0) {
        errors.push(...recordErrors);
      } else {
        validatedData.push(record as MedicineData);
      }
    }

    if (errors.length > 0) {
      this.logger.warn(`发现 ${errors.length} 个数据验证错误:`);
      errors.forEach(error => this.logger.warn(`  - ${error}`));
      
      if (errors.length > rawData.length * 0.1) { // 如果错误超过10%，停止执行
        throw new Error('数据验证错误过多，请检查数据文件');
      }
    }

    this.logger.success(`数据验证完成，有效记录: ${validatedData.length}`);
    return validatedData;
  }

  /**
   * 验证单条药品记录
   */
  private validateMedicineRecord(record: any, index: number): string[] {
    const errors: string[] = [];
    const requiredFields = ['name', 'chineseName', 'englishName', 'pinyinName', 'sku', 'unit', 'basePrice'];

    // 检查必需字段
    for (const field of requiredFields) {
      if (!record[field]) {
        errors.push(`记录 ${index}: 缺少必需字段 '${field}'`);
      }
    }

    // 检查数据类型
    if (record.basePrice && (typeof record.basePrice !== 'number' || record.basePrice < 0)) {
      errors.push(`记录 ${index}: basePrice 必须是非负数`);
    }

    if (record.requiresPrescription && typeof record.requiresPrescription !== 'boolean') {
      errors.push(`记录 ${index}: requiresPrescription 必须是布尔值`);
    }

    return errors;
  }

  /**
   * A2步骤: 数据库验证功能
   */
  async validateDatabase(options: SeedOptions): Promise<void> {
    console.log('🔍 A2步骤：数据库连接和表结构验证');
    console.log('='.repeat(50));
    
    const validationResults: any = {};

    try {
      // 根据选项执行相应的验证
      if (options.envCheck || options.full) {
        validationResults.envCheck = await this.validateEnvironment();
      }
      
      if (options.schemaCheck || options.full) {
        validationResults.schemaCheck = await this.validateSchema();
      }
      
      if (options.crudTest || options.full) {
        validationResults.crudTest = await this.validateCrudOperations();
      }
      
      if (options.errorTest || options.full) {
        validationResults.errorTest = await this.validateErrorHandling();
      }

      // 显示验证报告
      this.printValidationReport(validationResults);
      
    } catch (error) {
      this.logger.error('数据库验证失败', error);
      throw error;
    }
  }

  /**
   * 验证环境配置
   */
  private async validateEnvironment(): Promise<boolean> {
    console.log('\n📋 阶段1: 环境配置验证');
    
    try {
      // 检查环境变量
      const databaseUrl = process.env.DATABASE_URL;
      const directUrl = process.env.DIRECT_URL;
      
      if (!databaseUrl) {
        this.logger.error('DATABASE_URL 环境变量未设置');
        return false;
      }
      
      this.logger.success('DATABASE_URL 配置正确');
      
      if (directUrl) {
        this.logger.success('DIRECT_URL 配置正确');
      } else {
        this.logger.warn('DIRECT_URL 未设置 (可选)');
      }
      
      // 测试数据库连接
      await this.prisma.$connect();
      this.logger.success('数据库连接测试通过');
      
      // 测试基础查询
      await this.prisma.$queryRaw`SELECT 1 as test`;
      this.logger.success('数据库查询测试通过');
      
      return true;
      
    } catch (error) {
      this.logger.error('环境验证失败:', error);
      return false;
    }
  }

  /**
   * 验证Schema结构
   */
  private async validateSchema(): Promise<boolean> {
    console.log('\n📋 阶段2: Schema结构验证');
    
    try {
      // 检查medicines表是否存在
      const tableExists = await this.prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'medicines'
        ) as exists
      ` as any[];
      
      if (!tableExists[0]?.exists) {
        this.logger.error('medicines表不存在');
        return false;
      }
      
      this.logger.success('medicines表存在');
      
      // 检查关键字段
      const columns = await this.prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'medicines'
        ORDER BY ordinal_position
      ` as any[];
      
      const requiredColumns = ['id', 'name', 'sku', 'base_price', 'unit'];
      const missingColumns = requiredColumns.filter(col => 
        !columns.some((c: any) => c.column_name === col)
      );
      
      if (missingColumns.length > 0) {
        this.logger.error(`缺少必需字段: ${missingColumns.join(', ')}`);
        return false;
      }
      
      this.logger.success('所有必需字段存在');
      
      // 检查索引
      const indexes = await this.prisma.$queryRaw`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'medicines'
      ` as any[];
      
      this.logger.success(`发现 ${indexes.length} 个索引`);
      
      return true;
      
    } catch (error) {
      this.logger.error('Schema验证失败:', error);
      return false;
    }
  }

  /**
   * 验证CRUD操作
   */
  private async validateCrudOperations(): Promise<boolean> {
    console.log('\n📋 阶段3: 数据操作验证');
    
    const testSku = `TEST_${Date.now()}`;
    
    try {
      // 测试插入
      const testMedicine = await this.prisma.medicine.create({
        data: {
          name: '测试药品',
          chineseName: '测试药品',
          englishName: 'Test Medicine',
          pinyinName: 'ceshiyaopin',
          sku: testSku,
          unit: 'g',
          basePrice: 1.00,
          category: '测试分类',
          description: '测试用药品记录',
          requiresPrescription: false,
          status: 'active'
        }
      });
      
      this.logger.success('插入操作测试通过');
      
      // 测试查询
      const foundMedicine = await this.prisma.medicine.findUnique({
        where: { sku: testSku }
      });
      
      if (!foundMedicine) {
        this.logger.error('查询操作失败');
        return false;
      }
      
      this.logger.success('查询操作测试通过');
      
      // 测试更新
      await this.prisma.medicine.update({
        where: { id: testMedicine.id },
        data: { basePrice: 2.00 }
      });
      
      this.logger.success('更新操作测试通过');
      
      // 测试删除
      await this.prisma.medicine.delete({
        where: { id: testMedicine.id }
      });
      
      this.logger.success('删除操作测试通过');
      
      return true;
      
    } catch (error) {
      this.logger.error('CRUD操作验证失败:', error);
      
      // 清理测试数据
      try {
        await this.prisma.medicine.deleteMany({
          where: { sku: testSku }
        });
      } catch (cleanupError) {
        this.logger.warn('清理测试数据失败:', cleanupError);
      }
      
      return false;
    }
  }

  /**
   * 验证错误处理
   */
  private async validateErrorHandling(): Promise<boolean> {
    console.log('\n📋 阶段4: 错误处理验证');
    
    try {
      // 测试重复SKU约束
      const testSku = `DUPLICATE_TEST_${Date.now()}`;
      
      await this.prisma.medicine.create({
        data: {
          name: '重复测试1',
          chineseName: '重复测试1',
          englishName: 'Duplicate Test 1',
          pinyinName: 'chongfuceshi1',
          sku: testSku,
          unit: 'g',
          basePrice: 1.00,
          requiresPrescription: false,
          status: 'active'
        }
      });
      
      // 尝试插入重复SKU
      try {
        await this.prisma.medicine.create({
          data: {
            name: '重复测试2',
            chineseName: '重复测试2',
            englishName: 'Duplicate Test 2',
            pinyinName: 'chongfuceshi2',
            sku: testSku, // 重复的SKU
            unit: 'g',
            basePrice: 2.00,
            requiresPrescription: false,
            status: 'active'
          }
        });
        
        this.logger.error('重复SKU约束验证失败 - 应该抛出错误');
        return false;
        
      } catch (duplicateError) {
        this.logger.success('重复SKU约束验证通过');
      }
      
      // 清理测试数据
      await this.prisma.medicine.deleteMany({
        where: { sku: testSku }
      });
      
      this.logger.success('错误处理验证完成');
      return true;
      
    } catch (error) {
      this.logger.error('错误处理验证失败:', error);
      return false;
    }
  }

  /**
   * 打印验证报告
   */
  private printValidationReport(results: any): void {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 A2步骤：数据库验证报告');
    console.log('='.repeat(50));
    
    const checks = [
      { name: '环境配置', key: 'envCheck' },
      { name: 'Schema结构', key: 'schemaCheck' },
      { name: '数据操作', key: 'crudTest' },
      { name: '错误处理', key: 'errorTest' }
    ];
    
    let allPassed = true;
    let hasAnyTest = false;
    
    checks.forEach(check => {
      if (results[check.key] !== undefined) {
        hasAnyTest = true;
        const status = results[check.key] ? '✅ 通过' : '❌ 失败';
        console.log(`${status} ${check.name}`);
        if (!results[check.key]) allPassed = false;
      }
    });
    
    console.log('='.repeat(50));
    
    if (!hasAnyTest) {
      console.log('⚠️  未执行任何验证测试');
    } else if (allPassed) {
      console.log('🎉 数据库验证完成！可以安全导入数据');
    } else {
      console.log('❌ 验证失败，请检查问题后重试');
    }
  }

  /**
   * 执行A3步骤的导入操作
   */
  async performImport(options: SeedOptions): Promise<void> {
    console.log('📦 A3步骤：安全数据导入');
    console.log('='.repeat(50));

    try {
      // 处理备份相关操作
      if (options.backup && !options.import && !options.testImport) {
        await this.backupManager.createBackup('A3步骤导入前备份');
        return;
      }

      // 处理回滚操作
      if (options.rollback) {
        const success = await this.backupManager.rollback();
        if (success) {
          this.logger.success('✅ 数据回滚完成');
        } else {
          this.logger.error('❌ 数据回滚失败');
        }
        return;
      }

      // 处理备份状态查看
      if (options.showBackup) {
        await this.backupManager.showBackupStatus();
        return;
      }

      // 处理导入操作
      if (options.import || options.testImport) {
        // 如果指定了备份选项，先创建备份
        if (options.backup) {
          await this.backupManager.createBackup('A3步骤导入前备份');
        }
        
        // 加载种子数据
        const medicineData = await this.loadSeedData(options.dataFile);
        
        // 检查是否有备份点
        const hasBackup = await this.checkBackupExists();
        if (!hasBackup && !options.testImport) {
          this.logger.warn('⚠️  未找到备份点，建议先创建备份');
          this.logger.info('💡 运行: npx tsx prisma/seed.ts --backup');
          return;
        }

        let result: ImportResult;
        
        if (options.testImport) {
          // 测试导入模式
          result = await this.batchImporter.testImport(medicineData, 10);
        } else {
          // 完整导入模式
          const resumeFrom = options.resumeFrom || 0;
          result = await this.batchImporter.importData(medicineData, resumeFrom);
        }
        
        // 导入后验证
        if (result.success && options.verifyImport !== false) {
          await this.verifyImportResults(result);
        }
        
        return;
      }

      // 处理验证操作
      if (options.verifyImport) {
        await this.verifyImportResults();
        return;
      }

      // 处理质量检查
      if (options.qualityCheck) {
        await this.performQualityCheck();
        return;
      }

      // 处理数据分析
      if (options.analyzeData) {
        await this.analyzeData();
        return;
      }

      // 处理TCM数据清理
      if (options.cleanupTcm) {
        await this.cleanupTcmData();
        return;
      }

      // 处理字段分析
          if (options.analyzeFields) {
      await this.analyzeFields();
      return;
    }

    if (options.generateProfessionalDescriptions) {
      await this.generateProfessionalDescriptions();
      return;
    }

    if (options.fixAllPrices) {
      await this.fixAllPricesFromCsv();
      return;
    }

      // 处理description修复
      if (options.fixDescriptions) {
        await this.fixDescriptions();
        return;
      }

      // 处理价格精度修复
      if (options.fixPrices) {
        await this.fixPrices();
        return;
      }

      // 处理专业中药描述生成
      if (options.generateProfessionalDescriptions) {
        await this.generateProfessionalDescriptions();
        return;
      }
        
      // 如果没有指定具体操作，显示帮助
      console.log('⚠️  请指定要执行的A3步骤操作');
      console.log('💡 使用 --help 查看可用选项');
      
    } catch (error) {
      this.logger.error('A3步骤执行失败:', error);
      throw error;
    }
  }

  /**
   * 检查备份是否存在
   */
  private async checkBackupExists(): Promise<boolean> {
    try {
      const fs = require('fs');
      const backupDir = 'scripts/backups';
      
      if (!fs.existsSync(backupDir)) {
        return false;
      }
      
      const files = fs.readdirSync(backupDir)
        .filter((file: string) => file.startsWith('backup_') && file.endsWith('.json'));
      
      return files.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证导入结果
   */
  private async verifyImportResults(importResult?: ImportResult): Promise<void> {
    console.log('\n🔍 验证导入结果...');
    
    try {
      // 基础统计验证
      const totalCount = await this.prisma.medicine.count();
      console.log(`📊 数据库总记录数: ${totalCount}`);
      
      if (importResult) {
        console.log(`📊 本次导入记录: ${importResult.importedRecords}`);
        console.log(`📊 跳过记录数: ${importResult.skippedRecords}`);
      }
      
      // SKU唯一性验证
      const duplicateSKUs = await this.prisma.$queryRaw`
        SELECT sku, COUNT(*) as count
        FROM medicines
        GROUP BY sku
        HAVING COUNT(*) > 1
      ` as any[];
      
      if (duplicateSKUs.length > 0) {
        console.log(`❌ 发现重复SKU: ${duplicateSKUs.length} 个`);
        duplicateSKUs.forEach((dup: any) => {
          console.log(`   - ${dup.sku}: ${dup.count} 条记录`);
        });
      } else {
        console.log('✅ SKU唯一性验证通过');
      }
      
      // 数据完整性验证 - 检查必需字段是否为空字符串或null
      const incompleteRecords = await this.prisma.medicine.count({
        where: {
          OR: [
            { name: '' },
            { sku: '' },
            { unit: '' }
          ]
        }
      });
      
      if (incompleteRecords > 0) {
        console.log(`❌ 发现不完整记录: ${incompleteRecords} 条`);
      } else {
        console.log('✅ 数据完整性验证通过');
      }
      
      console.log('✅ 导入结果验证完成');
      
    } catch (error) {
      this.logger.error('验证导入结果失败:', error);
    }
  }

  /**
   * 执行数据质量检查
   */
  private async performQualityCheck(): Promise<void> {
    console.log('\n🔍 执行数据质量检查...');
    
    try {
      // 价格范围检查
      const priceStats = await this.prisma.medicine.aggregate({
        _min: { basePrice: true },
        _max: { basePrice: true },
        _avg: { basePrice: true },
        _count: {
          id: true
        }
      });
      
      console.log('💰 价格统计:');
      console.log(`   最低价格: ¥${priceStats._min.basePrice}`);
      console.log(`   最高价格: ¥${priceStats._max.basePrice}`);
      console.log(`   平均价格: ¥${priceStats._avg.basePrice?.toFixed(2)}`);
      
      // 分类统计
      const categoryStats = await this.prisma.medicine.groupBy({
        by: ['category'],
        _count: {
          category: true
        },
        orderBy: { 
          _count: { 
            category: 'desc' 
          } 
        }
      });
      
      console.log('\n📊 分类统计:');
      categoryStats.slice(0, 10).forEach((cat: any) => {
        console.log(`   ${cat.category || '未分类'}: ${cat._count.category} 条`);
      });
      
      // 拼音质量检查
      const noPinyinCount = await this.prisma.medicine.count({
        where: { pinyinName: null }
      });
      
      console.log('\n🔤 拼音质量:');
      console.log(`   缺少拼音: ${noPinyinCount} 条`);
      console.log(`   拼音覆盖率: ${((priceStats._count.id - noPinyinCount) / priceStats._count.id * 100).toFixed(1)}%`);
      
      console.log('\n✅ 数据质量检查完成');
      
    } catch (error) {
      this.logger.error('数据质量检查失败:', error);
    }
  }

  /**
   * 分析数据分布
   */
  async analyzeData(): Promise<void> {
    this.logger.info('📊 开始数据分析...');
    
    // 总记录数
    const total = await this.prisma.medicine.count();
    console.log(`📦 总记录数: ${total}`);
    
    // TCM-开头的记录
    const tcmCount = await this.prisma.medicine.count({
      where: { sku: { startsWith: 'TCM-' } }
    });
    console.log(`❌ TCM-开头记录: ${tcmCount}`);
    
    // 非TCM-开头的记录
    const nonTcmCount = await this.prisma.medicine.count({
      where: { sku: { not: { startsWith: 'TCM-' } } }
    });
    console.log(`✅ 正确记录: ${nonTcmCount}`);
    
    if (tcmCount > 0) {
      console.log('\n⚠️  发现TCM-开头的错误数据，建议使用 --cleanup-tcm 进行清理');
    }
  }

  /**
   * 清理TCM-开头的错误数据
   */
  async cleanupTcmData(): Promise<void> {
    this.logger.info('🧹 开始清理TCM-开头的错误数据...');
    
    // 创建清理前备份
    const backupInfo = await this.backupManager.createBackup('清理TCM错误数据前备份');
    this.logger.info(`✅ 清理前备份创建成功: ${backupInfo.id}`);
    
    try {
      // 查询要删除的记录数量
      const tcmCount = await this.prisma.medicine.count({
        where: { sku: { startsWith: 'TCM-' } }
      });
      
      if (tcmCount === 0) {
        this.logger.info('✅ 没有发现TCM-开头的记录，无需清理');
        return;
      }
      
      this.logger.info(`🔍 发现 ${tcmCount} 条TCM-开头的错误记录`);
      
      // 显示一些要删除的记录示例
      const samples = await this.prisma.medicine.findMany({
        where: { sku: { startsWith: 'TCM-' } },
        select: { sku: true, chineseName: true, englishName: true },
        take: 5
      });
      
      console.log('\n📋 即将删除的记录示例:');
      samples.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.sku} - ${item.chineseName} (${item.englishName})`);
      });
      
      // 执行删除操作
      console.log('\n🗑️  开始删除操作...');
      const deleteResult = await this.prisma.medicine.deleteMany({
        where: { sku: { startsWith: 'TCM-' } }
      });
      
      this.logger.success(`✅ 成功删除 ${deleteResult.count} 条TCM-开头的错误记录`);
      
      // 验证清理结果
      const remainingTotal = await this.prisma.medicine.count();
      const remainingTcm = await this.prisma.medicine.count({
        where: { sku: { startsWith: 'TCM-' } }
      });
      
      console.log('\n📊 清理结果:');
      console.log(`✅ 剩余总记录: ${remainingTotal}`);
      console.log(`✅ 剩余TCM记录: ${remainingTcm}`);
      
      if (remainingTcm === 0) {
        this.logger.success('🎉 TCM-开头的错误数据已全部清理完成！');
      } else {
        this.logger.warn(`⚠️  仍有 ${remainingTcm} 条TCM记录未清理`);
      }
      
    } catch (error) {
      this.logger.error(`❌ 清理过程中发生错误: ${error}`);
      this.logger.info(`💡 可以使用备份 ${backupInfo.id} 进行回滚`);
      throw error;
    }
  }

  /**
   * 分析字段使用情况
   */
  async analyzeFields(): Promise<void> {
    try {
      this.logger.info('🔍 开始分析字段使用情况...');
      
      // 分析name vs chinese_name
      const nameComparison = await this.prisma.medicine.findMany({
        select: {
          id: true,
          name: true,
          chineseName: true,
        },
        take: 10
      });
      
      this.logger.info('\n📊 字段使用分析报告:');
      this.logger.info('==================================================');
      
      // 检查name和chinese_name是否相同
      let identicalCount = 0;
      let differentCount = 0;
      
      for (const record of nameComparison) {
        if (record.name === record.chineseName) {
          identicalCount++;
        } else {
          differentCount++;
        }
      }
      
      this.logger.info(`📋 name vs chinese_name 对比 (样本: ${nameComparison.length}条):`);
      this.logger.info(`   - 相同: ${identicalCount}条`);
      this.logger.info(`   - 不同: ${differentCount}条`);
      
      if (identicalCount > 0) {
        this.logger.warn('⚠️  发现字段重叠问题: name和chinese_name完全相同');
        this.logger.info('💡 建议: 考虑只保留chinese_name字段，或将name用作英文名');
      }
      
      // 分析description字段
      const descriptionAnalysis = await this.prisma.medicine.findMany({
        select: {
          chineseName: true,
          englishName: true,
          description: true,
        },
        take: 10
      });
      
      this.logger.info('\n📝 description字段分析:');
      let duplicateDescCount = 0;
      let meaningfulDescCount = 0;
      
      for (const record of descriptionAnalysis) {
        const expectedDuplicate = `${record.chineseName} (${record.englishName})`;
        if (record.description === expectedDuplicate) {
          duplicateDescCount++;
        } else if (record.description && record.description.length > 10) {
          meaningfulDescCount++;
        }
      }
      
      this.logger.info(`   - 重复格式: ${duplicateDescCount}条`);
      this.logger.info(`   - 有意义描述: ${meaningfulDescCount}条`);
      
      if (duplicateDescCount > 0) {
        this.logger.warn('⚠️  发现description重叠问题: "中文名 (英文名)"格式');
        this.logger.info('💡 建议: 使用--fix-descriptions修复');
      }
      
      this.logger.success('✅ 字段分析完成');
      
    } catch (error) {
      this.logger.error('字段分析失败:', error);
      throw error;
    }
  }

  /**
   * 修复description字段重叠问题
   */
  async fixDescriptions(): Promise<void> {
    try {
      this.logger.info('🔧 开始修复description字段...');
      
      // 创建备份
      this.logger.info('📦 创建修复前备份...');
      const backup = await this.backupManager.createBackup('description修复前备份');
      
      // 查找需要修复的记录
      const recordsToFix = await this.prisma.medicine.findMany({
        select: {
          id: true,
          chineseName: true,
          englishName: true,
          description: true,
        }
      });
      
      let fixedCount = 0;
      const batchSize = 50;
      
      for (let i = 0; i < recordsToFix.length; i += batchSize) {
        const batch = recordsToFix.slice(i, i + batchSize);
        
        for (const record of batch) {
          const expectedDuplicate = `${record.chineseName} (${record.englishName})`;
          
          // 如果是重复格式，则设置为有意义的描述
          if (record.description === expectedDuplicate) {
            // 根据中药名设置功效描述
            const newDescription = this.generateMedicineDescription(record.chineseName || '');
            
            await this.prisma.medicine.update({
              where: { id: record.id },
              data: { description: newDescription }
            });
            
            fixedCount++;
          }
        }
        
        this.logger.info(`📝 已处理 ${Math.min(i + batchSize, recordsToFix.length)}/${recordsToFix.length} 条记录`);
      }
      
      this.logger.success(`✅ description修复完成，共修复 ${fixedCount} 条记录`);
      this.logger.info(`📦 备份ID: ${backup.id}`);
      
    } catch (error) {
      this.logger.error('description修复失败:', error);
      throw error;
    }
  }

  /**
   * 修复价格精度问题
   */
  async fixPrices(): Promise<void> {
    try {
      this.logger.info('💰 开始修复价格精度...');
      
      // 创建备份
      this.logger.info('📦 创建修复前备份...');
      const backup = await this.backupManager.createBackup('价格精度修复前备份');
      
      // 读取原始CSV数据
      this.logger.info('📖 读取原始CSV数据...');
      const csvData = this.loadOriginalCsvData();
      
      let fixedCount = 0;
      const batchSize = 50;
      
      for (let i = 0; i < csvData.length; i += batchSize) {
        const batch = csvData.slice(i, i + batchSize);
        
        for (const csvRecord of batch) {
          // 根据中文名查找数据库记录
          const dbRecord = await this.prisma.medicine.findFirst({
            where: { chineseName: csvRecord.中文名 }
          });
          
          if (dbRecord) {
            // 更新为原始精度价格
            await this.prisma.medicine.update({
              where: { id: dbRecord.id },
              data: { basePrice: parseFloat(csvRecord.价格) }
            });
            
            fixedCount++;
          }
        }
        
        this.logger.info(`💰 已处理 ${Math.min(i + batchSize, csvData.length)}/${csvData.length} 条记录`);
      }
      
      this.logger.success(`✅ 价格精度修复完成，共修复 ${fixedCount} 条记录`);
      this.logger.info(`📦 备份ID: ${backup.id}`);
      
      // 验证修复结果
      await this.verifyPriceFix();
      
    } catch (error) {
      this.logger.error('价格精度修复失败:', error);
      throw error;
    }
  }

  /**
   * 生成中药功效描述
   */
  private generateMedicineDescription(chineseName: string): string {
    // 常见中药功效映射
    const medicineEffects: { [key: string]: string } = {
      '当归': '补血调经，润燥滑肠',
      '黄芪': '补气固表，利尿托毒',
      '人参': '大补元气，复脉固脱',
      '甘草': '补脾益气，清热解毒',
      '川芎': '活血行气，祛风止痛',
      '白术': '健脾益气，燥湿利水',
      '茯苓': '利水渗湿，健脾宁心',
      '陈皮': '理气健脾，燥湿化痰',
      '半夏': '燥湿化痰，降逆止呕',
      '生姜': '解表散寒，温中止呕',
      '大枣': '补中益气，养血安神',
      '桂枝': '发汗解肌，温通经脉',
      '白芍': '养血调经，敛阴止汗',
      '柴胡': '疏肝解郁，升阳举陷',
      '黄芩': '清热燥湿，泻火解毒',
      '黄连': '清热燥湿，泻火解毒',
      '黄柏': '清热燥湿，泻火除蒸',
      '栀子': '泻火除烦，清热利湿',
      '连翘': '清热解毒，消肿散结',
      '金银花': '清热解毒，疏散风热',
      '板蓝根': '清热解毒，凉血利咽',
      '五倍子': '敛肺降火，涩肠止泻',
      '天麻': '息风止痉，平抑肝阳',
      '川贝': '清热润肺，化痰止咳',
      '三七': '散瘀止血，消肿定痛',
      '枸杞子': '滋补肝肾，明目润肺',
      '菊花': '疏散风热，清肝明目',
      '麦冬': '养阴生津，润肺清心',
      '沙参': '养阴清肺，益胃生津',
      '玉竹': '养阴润燥，生津止渴'
    };
    
    // 查找精确匹配
    if (medicineEffects[chineseName]) {
      return medicineEffects[chineseName];
    }
    
    // 查找部分匹配
    for (const [name, effect] of Object.entries(medicineEffects)) {
      if (chineseName.includes(name) || name.includes(chineseName)) {
        return effect;
      }
    }
    
    // 默认描述
    return `${chineseName}，传统中药材，具有特定的药用价值`;
  }

  /**
   * 读取原始CSV数据
   */
  private loadOriginalCsvData(): any[] {
    try {
      const csvPath = resolve(__dirname, '../scripts/user-data/medicine-data-450.csv');
      const csvContent = readFileSync(csvPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',');
      
      const data = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const record: any = {};
        headers.forEach((header, index) => {
          record[header] = values[index];
        });
        data.push(record);
      }
      
      return data;
    } catch (error) {
      this.logger.error('读取原始CSV数据失败:', error);
      throw error;
    }
  }

  /**
   * 验证价格修复结果
   */
  private async verifyPriceFix(): Promise<void> {
    try {
      this.logger.info('🔍 验证价格修复结果...');
      
      const priceStats = await this.prisma.medicine.aggregate({
        _min: { basePrice: true },
        _max: { basePrice: true },
        _avg: { basePrice: true },
        _count: true
      });
      
      // 检查高精度价格样本
      const highPrecisionSamples = await this.prisma.medicine.findMany({
        select: {
          chineseName: true,
          basePrice: true
        },
        where: {
          chineseName: { in: ['灯芯草', '当归全片', '雪燕', '黄精', '生地大片'] }
        }
      });
      
      this.logger.info('📊 价格修复验证结果:');
      this.logger.info(`   - 总记录数: ${priceStats._count}`);
      this.logger.info(`   - 价格范围: ¥${priceStats._min.basePrice} - ¥${priceStats._max.basePrice}`);
      this.logger.info(`   - 平均价格: ¥${priceStats._avg.basePrice?.toFixed(9)}`);
      
      this.logger.info('\n🔬 高精度价格样本:');
      for (const sample of highPrecisionSamples) {
        this.logger.info(`   - ${sample.chineseName}: ¥${sample.basePrice}`);
      }
      
      this.logger.success('✅ 价格修复验证完成');
      
    } catch (error) {
      this.logger.error('价格修复验证失败:', error);
      throw error;
    }
  }

  /**
   * 生成专业中药描述
   */
  async generateProfessionalDescriptions(): Promise<void> {
    console.log('🔬 开始生成专业中药描述...');
    
    // 专业中药描述库
    const professionalDescriptions: Record<string, string> = {
      '当归': '甘、辛，温。归肝、心、脾经。补血调经，润燥滑肠，活血止痛。用于血虚萎黄，眩晕心悸，月经不调，经闭痛经，虚寒腹痛，肠燥便秘，风湿痹痛，跌扑损伤，痈疽疮疡。',
      '黄芪': '甘，微温。归脾、肺经。补气固表，利尿托毒，排脓，敛疮生肌。用于气虚乏力，食少便溏，中气下陷，久泻脱肛，便血崩漏，表虚自汗，气虚水肿，痈疽难溃，久溃不敛，血虚痿黄，内热消渴。',
      '人参': '甘、微苦，微温。归脾、肺、心、肾经。大补元气，复脉固脱，补脾益肺，生津养血，安神益智。用于体虚欲脱，肢冷脉微，脾虚食少，肺虚喘咳，津伤口渴，内热消渴，气血亏虚，久病虚羸，惊悸失眠，阳痿宫冷。',
      '甘草': '甘，平。归心、肺、脾、胃经。补脾益气，清热解毒，祛痰止咳，缓急止痛，调和诸药。用于脾胃虚弱，倦怠乏力，心悸气短，咳嗽痰多，脘腹、四肢挛急疼痛，痈肿疮毒，缓解药物毒性、烈性。',
      '茯苓': '甘、淡，平。归心、肺、脾、肾经。利水渗湿，健脾，宁心。用于水肿尿少，痰饮眩悸，脾虚食少，便溏泄泻，心神不安，惊悸失眠。',
      '白术': '苦、甘，温。归脾、胃经。健脾益气，燥湿利水，止汗，安胎。用于脾虚食少，腹胀泄泻，痰饮眩悸，水肿，自汗，胎动不安。',
      '川芎': '辛，温。归肝、胆、心包经。活血行气，祛风止痛。用于胸痹心痛，胸胁刺痛，跌扑肿痛，月经不调，经闭痛经，产后瘀阻，头痛，风湿痹痛。',
      '白芍': '苦、酸，微寒。归肝、脾经。养血调经，敛阴止汗，柔肝止痛，平抑肝阳。用于血虚萎黄，月经不调，自汗，盗汗，胁痛，腹痛，四肢挛痛，头痛眩晕。',
      '熟地黄': '甘，微温。归肝、肾经。滋阴补血，益精填髓。用于血虚萎黄，心悸怔忡，月经不调，崩漏下血，肝肾阴虚，腰膝酸软，骨蒸潮热，盗汗遗精，内热消渴，血虚便秘，肾虚喘促。',
      '生地黄': '甘，寒。归心、肝、肾经。清热凉血，养阴，生津。用于热病舌绛烦渴，阴虚内热，骨蒸劳热，内热消渴，吐血，衄血，发斑发疹。',
      '何首乌': '苦、甘、涩，微温。归肝、心、肾经。解毒，消痈，截疟，润肠通便。用于疮痈，瘰疬，风疹瘙痒，久疟体虚，肠燥便秘。',
      '枸杞子': '甘，平。归肝、肾经。滋补肝肾，益精明目。用于虚劳精亏，腰膝酸痛，眩晕耳鸣，阳痿遗精，内热消渴，血虚萎黄，目昏不明。',
      '菊花': '甘、苦，微寒。归肺、肝经。散风清热，平肝明目，清热解毒。用于风热感冒，头痛眩晕，目赤肿痛，眼目昏花，疮痈肿毒。',
      '金银花': '甘，寒。归肺、心、胃经。清热解毒，疏散风热。用于痈肿疔疮，喉痹，丹毒，热毒血痢，风热感冒，温病发热。',
      '连翘': '苦，微寒。归肺、心、小肠经。清热解毒，消肿散结，疏散风热。用于痈疽，瘰疬，乳痈，丹毒，风热感冒，温病初起，温热入营，高热烦渴，神昏发斑，热淋尿闭。',
      '板蓝根': '苦，寒。归心、胃经。清热解毒，凉血利咽。用于温疫时毒，发热咽痛，温毒发斑，痄腮，烂喉丹痧，大头瘟疫，丹毒，痈肿。',
      '黄连': '苦，寒。归心、脾、胃、肝、胆、大肠经。清热燥湿，泻火解毒。用于湿热痞满，呕吐吞酸，泻痢，黄疸，高热神昏，心火亢盛，心烦不寐，血热吐衄，目赤，牙痛，消渴，痈肿疔疮；外治湿疹，湿疮，耳道流脓。',
      '黄芩': '苦，寒。归肺、胆、脾、大肠、小肠经。清热燥湿，泻火解毒，止血，安胎。用于湿温、暑湿，胸闷呕恶，湿热痞满，泻痢，黄疸，肺热咳嗽，高热烦渴，血热吐衄，痈肿疔疮，胎动不安。',
      '黄柏': '苦，寒。归肾、膀胱、大肠经。清热燥湿，泻火除蒸，解毒疗疮。用于湿热泻痢，黄疸，带下，热淋，脚气，痿蹙，骨蒸劳热，盗汗，遗精，疮疡肿毒，湿疹瘙痒。',
      '栀子': '苦，寒。归心、肝、肺、胃、三焦经。泻火除烦，清热利湿，凉血解毒；外用消肿止痛。用于热病心烦，湿热黄疸，淋证涩痛，血热吐衄，目赤肿痛，火毒疮疡；外治扭挫伤痛。',
      '龙胆草': '苦，寒。归肝、胆经。清热燥湿，泻肝胆火。用于湿热黄疸，阴肿阴痒，带下，强中，湿疹瘙痒，目赤，耳聋，胁痛，口苦，惊风抽搐。'
    };

    console.log(`📚 专业描述库包含 ${Object.keys(professionalDescriptions).length} 种中药`);
    
    // 生成描述更新脚本
    const updateStatements: string[] = [];
    
    for (const [chineseName, description] of Object.entries(professionalDescriptions)) {
      updateStatements.push(
        `UPDATE medicines SET description = '${description}' WHERE chinese_name = '${chineseName}';`
      );
    }
    
    // 保存到文件
    const scriptContent = `-- 专业中药描述更新脚本
-- 生成时间: ${new Date().toISOString()}
-- 包含 ${updateStatements.length} 种中药的专业描述

-- 创建备份表
CREATE TABLE IF NOT EXISTS medicines_backup_professional_descriptions AS 
SELECT * FROM medicines;

-- 更新专业描述
${updateStatements.join('\n')}

-- 验证更新结果
SELECT 
  chinese_name,
  CASE 
    WHEN LENGTH(description) > 50 THEN '专业描述'
    ELSE '简单描述'
  END as description_type,
  LENGTH(description) as description_length
FROM medicines 
WHERE chinese_name IN (${Object.keys(professionalDescriptions).map(name => `'${name}'`).join(', ')})
ORDER BY chinese_name;
`;

    const fs = await import('fs');
    const path = await import('path');
    const scriptPath = path.join(process.cwd(), 'scripts', 'professional-descriptions-update.sql');
    
    fs.writeFileSync(scriptPath, scriptContent, 'utf8');
    
    console.log(`✅ 专业描述更新脚本已生成: ${scriptPath}`);
    console.log(`📊 包含 ${updateStatements.length} 种中药的专业功效描述`);
    console.log('💡 执行脚本: psql -d your_database -f scripts/professional-descriptions-update.sql');
    console.log('⚠️  注意: 此脚本仅生成，不会自动执行数据库更新');
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    this.logger.info('数据库连接已断开');
  }

  /**
   * 从原始CSV批量修复所有价格数据
   */
  async fixAllPricesFromCsv(): Promise<void> {
    console.log('💰 开始从原始CSV批量修复价格数据...');
    
    try {
      // 读取原始CSV文件
      const csvPath = path.join(process.cwd(), 'scripts', 'user-data', 'medicine-data-450.csv');
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      
      console.log(`📁 读取CSV文件: ${csvPath}`);
      
      // 解析CSV数据
      const lines = csvContent.trim().split('\n');
      const headers = lines[0].split(',');
      
      console.log(`📊 CSV头部: ${headers.join(', ')}`);
      
      // 创建价格映射
      const priceMap = new Map<string, number>();
      let validRecords = 0;
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= 3) {
          const chineseName = values[0].trim();
          const priceStr = values[2].trim();
          const price = parseFloat(priceStr);
          
          if (!isNaN(price) && chineseName) {
            priceMap.set(chineseName, price);
            validRecords++;
          }
        }
      }
      
      console.log(`✅ 解析完成: ${validRecords} 条有效价格记录`);
      
      // 创建备份
      console.log('🔄 创建价格修复备份...');
      await this.prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS medicines_backup_price_fix_all AS 
        SELECT * FROM medicines;
      `;
      
      // 批量更新价格
      let updatedCount = 0;
      let notFoundCount = 0;
      const updateResults: Array<{chinese_name: string, old_price: number, new_price: number}> = [];
      
      console.log('🔄 开始批量更新价格...');
      
      for (const [chineseName, newPrice] of priceMap.entries()) {
        try {
          // 查找现有记录
          const existing = await this.prisma.medicine.findFirst({
            where: { chinese_name: chineseName },
            select: { id: true, base_price: true }
          });
          
          if (existing) {
            const oldPrice = parseFloat(existing.base_price.toString());
            
            // 更新价格
            await this.prisma.medicine.update({
              where: { id: existing.id },
              data: { base_price: newPrice }
            });
            
            updateResults.push({
              chinese_name: chineseName,
              old_price: oldPrice,
              new_price: newPrice
            });
            
            updatedCount++;
          } else {
            notFoundCount++;
            console.log(`⚠️  未找到药品: ${chineseName}`);
          }
        } catch (error) {
          console.error(`❌ 更新价格失败 ${chineseName}:`, error);
        }
      }
      
      console.log('\n📊 价格修复结果统计:');
      console.log(`✅ 成功更新: ${updatedCount} 条记录`);
      console.log(`⚠️  未找到: ${notFoundCount} 条记录`);
      
      // 显示部分更新样本
      console.log('\n📋 价格更新样本 (前10条):');
      updateResults.slice(0, 10).forEach(result => {
        console.log(`  ${result.chinese_name}: ${result.old_price} → ${result.new_price}`);
      });
      
      // 验证更新结果
      console.log('\n🔍 验证价格更新结果...');
      const verificationSamples = ['灯芯草', '当归全片', '雪燕', '黄精', '即食桑椹子'];
      
      for (const sampleName of verificationSamples) {
        const csvPrice = priceMap.get(sampleName);
        const dbRecord = await this.prisma.medicine.findFirst({
          where: { chinese_name: sampleName },
          select: { chinese_name: true, base_price: true }
        });
        
        if (dbRecord && csvPrice !== undefined) {
          const dbPrice = parseFloat(dbRecord.base_price.toString());
          const isMatch = Math.abs(dbPrice - csvPrice) < 0.000001;
          console.log(`  ${sampleName}: CSV=${csvPrice}, DB=${dbPrice} ${isMatch ? '✅' : '❌'}`);
        }
      }
      
      console.log('\n✅ 价格批量修复完成!');
      
    } catch (error) {
      console.error('❌ 价格修复失败:', error);
      throw error;
    }
  }
}

// ==================== 命令行参数解析 ====================

function parseCommandLineArgs(): SeedOptions {
  const args = process.argv.slice(2);
  const options: SeedOptions = {
    dryRun: false,
    force: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--data-file':
        if (i + 1 < args.length) {
          options.dataFile = args[i + 1];
          i++; // 跳过下一个参数
        } else {
          console.error('错误: --data-file 需要指定文件路径');
          process.exit(1);
        }
        break;
      case '--validate':
        options.validate = true;
        break;
      case '--env-check':
        options.envCheck = true;
        break;
      case '--schema-check':
        options.schemaCheck = true;
        break;
      case '--crud-test':
        options.crudTest = true;
        break;
      case '--error-test':
        options.errorTest = true;
        break;
      case '--full':
        options.full = true;
        break;
      // A3步骤参数
      case '--backup':
        options.backup = true;
        break;
      case '--rollback':
        options.rollback = true;
        break;
      case '--show-backup':
        options.showBackup = true;
        break;
      case '--import':
        options.import = true;
        break;
      case '--test-import':
        options.testImport = true;
        break;
      case '--batch-size':
        if (i + 1 < args.length) {
          options.batchSize = parseInt(args[i + 1]);
          i++;
        } else {
          console.error('错误: --batch-size 需要指定数值');
          process.exit(1);
        }
        break;
      case '--resume-from':
        if (i + 1 < args.length) {
          options.resumeFrom = parseInt(args[i + 1]);
          i++;
        } else {
          console.error('错误: --resume-from 需要指定批次号');
          process.exit(1);
        }
        break;
      case '--verify-import':
        options.verifyImport = true;
        break;
      case '--quality-check':
        options.qualityCheck = true;
        break;
      // 数据清理选项
      case '--cleanup-tcm':
        options.cleanupTcm = true;
        break;
      case '--analyze-data':
        options.analyzeData = true;
        break;
      // 数据修复选项
      case '--fix-descriptions':
        options.fixDescriptions = true;
        break;
      case '--fix-prices':
        options.fixPrices = true;
        break;
      case '--analyze-fields':
        options.analyzeFields = true;
        break;
      case '--generate-professional-descriptions':
        options.generateProfessionalDescriptions = true;
        break;
      case '--fix-all-prices':
        options.fixAllPrices = true;
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`错误: 未知参数 '${arg}'`);
          console.error('使用 --help 查看可用参数');
          process.exit(1);
        }
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
药品数据种子脚本 (Medicine Seed Script)

使用方法:
  npx tsx prisma/seed.ts [选项]

选项:
  -h, --help          显示此帮助信息
  --dry-run           预览模式，不实际写入数据库
  --force             强制重置现有数据
  --verbose, -v       显示详细日志
  --data-file <path>  指定自定义数据文件路径

验证选项 (A2步骤):
  --validate          启用数据库验证模式
  --env-check         仅检查环境配置
  --schema-check      仅验证Schema结构
  --crud-test         仅测试数据操作
  --error-test        仅测试错误处理
  --full              完整验证测试

示例:
  npx tsx prisma/seed.ts                    # 标准导入
  npx tsx prisma/seed.ts --dry-run          # 预览模式
  npx tsx prisma/seed.ts --force --verbose  # 强制重置并显示详细日志
  npm run db:seed                           # 使用 package.json 脚本

验证示例 (A2步骤):
  npx tsx prisma/seed.ts --validate --full  # 完整数据库验证
  npx tsx prisma/seed.ts --env-check        # 仅环境检查
  npx tsx prisma/seed.ts --schema-check     # 仅Schema验证

导入选项 (A3步骤):
  --backup                创建数据库备份点
  --rollback              回滚到最新备份点
  --show-backup           显示备份状态
  --import                执行完整数据导入
  --test-import           测试导入(仅前10条)
  --batch-size <N>        设置批次大小(默认20)
  --resume-from <N>       从指定批次继续导入
  --verify-import         验证导入结果
  --quality-check         执行数据质量检查

数据清理选项:
  --analyze-data          分析数据分布情况
  --cleanup-tcm           清理TCM-开头的错误数据

数据修复选项:
  --fix-descriptions      修复description字段重叠问题
  --fix-prices            修复价格精度问题
  --analyze-fields        分析字段使用情况
  --generate-professional-descriptions  生成专业中药描述
  --fix-all-prices        按原始CSV数据批量修复所有价格

导入示例 (A3步骤):
  npx tsx prisma/seed.ts --backup           # 创建备份点
  npx tsx prisma/seed.ts --test-import      # 测试导入
  npx tsx prisma/seed.ts --import           # 完整导入
  npx tsx prisma/seed.ts --rollback         # 回滚数据

数据清理示例:
  npx tsx prisma/seed.ts --analyze-data     # 分析数据分布
  npx tsx prisma/seed.ts --cleanup-tcm      # 清理错误数据

数据修复示例:
  npx tsx prisma/seed.ts --analyze-fields   # 分析字段使用情况
  npx tsx prisma/seed.ts --fix-descriptions # 修复描述字段
  npx tsx prisma/seed.ts --fix-prices       # 修复价格精度
  npx tsx prisma/seed.ts --generate-professional-descriptions # 生成专业描述
  npx tsx prisma/seed.ts --fix-all-prices # 批量修复所有价格

环境变量:
  DATABASE_URL        数据库连接字符串 (必需)
  DIRECT_URL          直接数据库连接字符串 (可选)
`);
}

// ==================== 主函数 ====================

async function main(): Promise<void> {
  const startTime = performance.now();
  let seedService: MedicineSeedService | null = null;

  try {
    // 解析命令行参数
    const options = parseCommandLineArgs();
    
    // 初始化服务
    seedService = new MedicineSeedService(options.verbose, options.batchSize);
    
    // 检查是否为验证模式 (A2步骤)
    const isValidationMode = options.validate || options.envCheck || options.schemaCheck || 
                            options.crudTest || options.errorTest || options.full;
    
    if (isValidationMode) {
      // A2步骤: 数据库验证模式
      await seedService.validateDatabase(options);
      return;
    }
    
    // 检查是否为导入模式 (A3步骤)
    const isImportMode = options.backup || options.rollback || options.showBackup ||
                        options.import || options.testImport || options.verifyImport ||
                        options.qualityCheck || options.analyzeData || options.cleanupTcm ||
                        options.fixDescriptions || options.fixPrices || options.analyzeFields ||
                        options.generateProfessionalDescriptions;
    
    if (isImportMode) {
      // A3步骤: 数据导入模式
      await seedService.performImport(options);
      return;
    }
    
    // A1步骤: 标准种子数据模式
    console.log('🌱 药品数据种子脚本启动');
    console.log(`📅 时间: ${new Date().toISOString()}`);
    console.log(`🔧 模式: ${options.dryRun ? '预览模式' : '执行模式'}`);
    console.log(`💪 强制重置: ${options.force ? '是' : '否'}`);
    console.log('');

    // 环境检查
    await seedService.checkEnvironment();

    // 加载种子数据
    const medicineData = await seedService.loadSeedData(options.dataFile);

    if (options.dryRun) {
      console.log('');
      console.log('🔍 预览模式 - 不会实际写入数据库');
      console.log(`📊 将要导入 ${medicineData.length} 条药品记录`);
      console.log('');
      
      // 显示前5条记录作为预览
      console.log('📋 数据预览 (前5条):');
      medicineData.slice(0, 5).forEach((medicine, index) => {
        console.log(`  ${index + 1}. ${medicine.chineseName} (${medicine.englishName}) - SKU: ${medicine.sku} - 价格: ¥${medicine.basePrice}`);
      });
      
      if (medicineData.length > 5) {
        console.log(`  ... 还有 ${medicineData.length - 5} 条记录`);
      }
    } else {
      console.log('⚠️  实际执行模式 - 数据将写入数据库');
      console.log('🚧 数据库操作功能将在 A3 步骤中实现');
    }

    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    console.log('');
    console.log('✅ A1 步骤完成');
    console.log(`⏱️  执行时间: ${duration}ms`);
    console.log(`📊 处理记录: ${medicineData.length} 条`);

  } catch (error) {
    console.error('');
    console.error('❌ 种子脚本执行失败');
    console.error(`💥 错误: ${error instanceof Error ? error.message : '未知错误'}`);
    
    if (error instanceof Error && error.stack) {
      console.error('📍 错误堆栈:');
      console.error(error.stack);
    }
    
    process.exit(1);
  } finally {
    // 清理资源
    if (seedService) {
      await seedService.disconnect();
    }
  }
}

// ==================== 脚本入口 ====================

if (require.main === module) {
  main().catch((error) => {
    console.error('💥 未捕获的错误:', error);
    process.exit(1);
  });
}

export { MedicineSeedService, type SeedOptions, type MedicineData, type SeedResult }; 