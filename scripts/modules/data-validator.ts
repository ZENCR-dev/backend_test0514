#!/usr/bin/env tsx

import { 
  InputMedicineData, 
  ProcessingMedicineData, 
  CompleteMedicineData,
  ValidationResult 
} from '../types/medicine-types.js';
import { logger } from '../utils/logger.js';

/**
 * 数据验证器
 * 提供输入、处理和输出阶段的数据验证功能
 */
export class DataValidator {

  /**
   * 验证TSV输入数据
   */
  validateInputData(data: InputMedicineData[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let validCount = 0;

    if (!data || data.length === 0) {
      return {
        isValid: false,
        errors: ['输入数据为空'],
        warnings: [],
        summary: { valid: 0, invalid: 0, total: 0 }
      };
    }

    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      const recordErrors = this.validateSingleInputRecord(record, i + 1);
      
      if (recordErrors.length === 0) {
        validCount++;
      } else {
        errors.push(...recordErrors);
      }

      // 检查警告条件
      if (record.pricePerGram > 100) {
        warnings.push(`第${i + 1}行: 价格偏高 ${record.pricePerGram} 元/克 (${record.chineseName})`);
      }

      if (record.chineseName.length > 10) {
        warnings.push(`第${i + 1}行: 中文名过长 "${record.chineseName}" (${record.chineseName.length}字符)`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        valid: validCount,
        invalid: data.length - validCount,
        total: data.length
      }
    };
  }

  /**
   * 验证单条输入记录
   */
  private validateSingleInputRecord(record: InputMedicineData, lineNumber: number): string[] {
    const errors: string[] = [];

    // 中文名验证
    if (!record.chineseName || record.chineseName.trim() === '') {
      errors.push(`第${lineNumber}行: 中文名为空`);
    } else if (record.chineseName.length > 100) {
      errors.push(`第${lineNumber}行: 中文名过长 (${record.chineseName.length}字符，最大100字符)`);
    } else if (!/[\u4e00-\u9fff]/.test(record.chineseName)) {
      errors.push(`第${lineNumber}行: 中文名不包含中文字符 "${record.chineseName}"`);
    }

    // 英文名验证
    if (!record.englishName || record.englishName.trim() === '') {
      errors.push(`第${lineNumber}行: 英文名为空`);
    } else if (record.englishName.length > 255) {
      errors.push(`第${lineNumber}行: 英文名过长 (${record.englishName.length}字符，最大255字符)`);
    }

    // 价格验证
    if (record.pricePerGram === undefined || record.pricePerGram === null) {
      errors.push(`第${lineNumber}行: 价格为空`);
    } else if (isNaN(record.pricePerGram)) {
      errors.push(`第${lineNumber}行: 价格不是数字 "${record.pricePerGram}"`);
    } else if (record.pricePerGram < 0) {
      errors.push(`第${lineNumber}行: 价格不能为负数 ${record.pricePerGram}`);
    } else if (record.pricePerGram > 10000) {
      errors.push(`第${lineNumber}行: 价格过高 ${record.pricePerGram} 元/克 (最大10000元/克)`);
    }

    return errors;
  }

  /**
   * 验证处理过程中的数据
   */
  validateProcessingData(data: ProcessingMedicineData[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let validCount = 0;

    if (!data || data.length === 0) {
      return {
        isValid: false,
        errors: ['处理数据为空'],
        warnings: [],
        summary: { valid: 0, invalid: 0, total: 0 }
      };
    }

    // 检查重复的中文名
    const chineseNameCounts = new Map<string, number>();
    data.forEach(record => {
      const name = record.chineseName.trim();
      chineseNameCounts.set(name, (chineseNameCounts.get(name) || 0) + 1);
    });

    // 检查重复的SKU
    const skuCounts = new Map<string, number>();
    data.forEach(record => {
      const sku = record.sku.trim();
      skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
    });

    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      const recordErrors = this.validateSingleProcessingRecord(record, i + 1);
      
      if (recordErrors.length === 0) {
        validCount++;
      } else {
        errors.push(...recordErrors);
      }

      // 重复检查
      if (chineseNameCounts.get(record.chineseName) > 1) {
        warnings.push(`第${i + 1}行: 中文名重复 "${record.chineseName}"`);
      }

      if (skuCounts.get(record.sku) > 1) {
        errors.push(`第${i + 1}行: SKU重复 "${record.sku}"`);
      }

      // 拼音质量检查
      if (record.pinyinName.length < 2) {
        warnings.push(`第${i + 1}行: 拼音过短 "${record.pinyinName}"`);
      }

      if (!/^[a-z]+$/.test(record.pinyinName)) {
        warnings.push(`第${i + 1}行: 拼音包含非字母字符 "${record.pinyinName}"`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        valid: validCount,
        invalid: data.length - validCount,
        total: data.length
      }
    };
  }

  /**
   * 验证单条处理记录
   */
  private validateSingleProcessingRecord(record: ProcessingMedicineData, lineNumber: number): string[] {
    const errors: string[] = [];

    // 继承输入验证
    const inputErrors = this.validateSingleInputRecord(record, lineNumber);
    errors.push(...inputErrors);

    // 拼音名验证
    if (!record.pinyinName || record.pinyinName.trim() === '') {
      errors.push(`第${lineNumber}行: 拼音名为空`);
    } else if (record.pinyinName.length > 100) {
      errors.push(`第${lineNumber}行: 拼音名过长 (${record.pinyinName.length}字符，最大100字符)`);
    }

    // SKU验证
    if (!record.sku || record.sku.trim() === '') {
      errors.push(`第${lineNumber}行: SKU为空`);
    } else if (record.sku.length > 50) {
      errors.push(`第${lineNumber}行: SKU过长 (${record.sku.length}字符，最大50字符)`);
    } else if (!/^[A-Za-z0-9]+$/.test(record.sku)) {
      errors.push(`第${lineNumber}行: SKU包含非法字符 "${record.sku}" (只允许字母和数字)`);
    }

    return errors;
  }

  /**
   * 验证最终输出数据
   */
  validateOutputData(data: CompleteMedicineData[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let validCount = 0;

    if (!data || data.length === 0) {
      return {
        isValid: false,
        errors: ['输出数据为空'],
        warnings: [],
        summary: { valid: 0, invalid: 0, total: 0 }
      };
    }

    // 检查必填字段完整性
    const requiredFields = ['name', 'sku'];
    
    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      const recordErrors: string[] = [];

      // 必填字段检查
      requiredFields.forEach(field => {
        if (!record[field as keyof CompleteMedicineData] || 
            String(record[field as keyof CompleteMedicineData]).trim() === '') {
          recordErrors.push(`第${i + 1}行: 必填字段 "${field}" 为空`);
        }
      });

      // 数据类型检查
      if (record.pricePerGram !== undefined && (isNaN(record.pricePerGram) || record.pricePerGram < 0)) {
        recordErrors.push(`第${i + 1}行: 价格格式错误 "${record.pricePerGram}"`);
      }

      // 字段长度检查
      if (record.name && record.name.length > 100) {
        recordErrors.push(`第${i + 1}行: 名称过长 (${record.name.length}字符)`);
      }

      if (record.sku && record.sku.length > 50) {
        recordErrors.push(`第${i + 1}行: SKU过长 (${record.sku.length}字符)`);
      }

      if (recordErrors.length === 0) {
        validCount++;
      } else {
        errors.push(...recordErrors);
      }

      // 可选字段警告
      if (!record.chineseName && !record.englishName) {
        warnings.push(`第${i + 1}行: 缺少中文名和英文名 (${record.name})`);
      }

      if (!record.pinyinName) {
        warnings.push(`第${i + 1}行: 缺少拼音名 (${record.name})`);
      }
    }

    // 全局唯一性检查
    const skuSet = new Set<string>();
    const duplicateSkus: string[] = [];
    
    data.forEach((record, index) => {
      if (record.sku) {
        if (skuSet.has(record.sku)) {
          duplicateSkus.push(`第${index + 1}行: SKU重复 "${record.sku}"`);
        } else {
          skuSet.add(record.sku);
        }
      }
    });

    errors.push(...duplicateSkus);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        valid: validCount,
        invalid: data.length - validCount,
        total: data.length
      }
    };
  }

  /**
   * 验证数据完整性
   */
  validateDataIntegrity(
    inputData: InputMedicineData[], 
    outputData: CompleteMedicineData[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (inputData.length !== outputData.length) {
      errors.push(`数据量不匹配: 输入${inputData.length}条，输出${outputData.length}条`);
    }

    // 检查数据对应关系
    for (let i = 0; i < Math.min(inputData.length, outputData.length); i++) {
      const input = inputData[i];
      const output = outputData[i];

      if (input.chineseName !== output.chineseName) {
        warnings.push(`第${i + 1}行: 中文名不匹配 "${input.chineseName}" vs "${output.chineseName}"`);
      }

      if (input.englishName !== output.englishName) {
        warnings.push(`第${i + 1}行: 英文名不匹配 "${input.englishName}" vs "${output.englishName}"`);
      }

      if (Math.abs((input.pricePerGram || 0) - (output.pricePerGram || 0)) > 0.01) {
        warnings.push(`第${i + 1}行: 价格不匹配 ${input.pricePerGram} vs ${output.pricePerGram}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        valid: Math.min(inputData.length, outputData.length),
        invalid: Math.abs(inputData.length - outputData.length),
        total: Math.max(inputData.length, outputData.length)
      }
    };
  }

  /**
   * 生成验证摘要报告
   */
  generateValidationSummary(
    inputValidation: ValidationResult,
    processingValidation: ValidationResult,
    outputValidation: ValidationResult,
    integrityValidation: ValidationResult
  ): {
    overallValid: boolean;
    totalErrors: number;
    totalWarnings: number;
    stageResults: Record<string, { valid: boolean; errors: number; warnings: number }>;
    recommendations: string[];
  } {
    const stages = {
      'input': inputValidation,
      'processing': processingValidation,
      'output': outputValidation,
      'integrity': integrityValidation
    };

    let totalErrors = 0;
    let totalWarnings = 0;
    const stageResults: Record<string, { valid: boolean; errors: number; warnings: number }> = {};

    Object.entries(stages).forEach(([stage, result]) => {
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;
      stageResults[stage] = {
        valid: result.isValid,
        errors: result.errors.length,
        warnings: result.warnings.length
      };
    });

    const recommendations: string[] = [];
    
    if (totalErrors > 0) {
      recommendations.push('请修复所有错误后再次运行');
    }
    
    if (totalWarnings > 10) {
      recommendations.push('警告数量较多，建议检查数据质量');
    }

    if (!outputValidation.isValid) {
      recommendations.push('输出数据验证失败，请检查数据转换逻辑');
    }

    return {
      overallValid: totalErrors === 0,
      totalErrors,
      totalWarnings,
      stageResults,
      recommendations
    };
  }
} 