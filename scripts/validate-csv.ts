#!/usr/bin/env node

/**
 * CSV/TSV文件格式验证工具
 * 用于检查用户上传的药品数据文件格式是否符合要求
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalRows: number;
    validRows: number;
    emptyRows: number;
    encoding: string;
    separator: string;
  };
}

class CSVValidator {
  private filePath: string;
  private content: string;
  private lines: string[];

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = '';
    this.lines = [];
  }

  /**
   * 验证文件
   */
  validate(): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      stats: {
        totalRows: 0,
        validRows: 0,
        emptyRows: 0,
        encoding: 'UTF-8',
        separator: 'TAB'
      }
    };

    try {
      // 1. 检查文件是否存在
      if (!fs.existsSync(this.filePath)) {
        result.errors.push(`文件不存在: ${this.filePath}`);
        result.isValid = false;
        return result;
      }

      // 2. 读取文件内容
      this.content = fs.readFileSync(this.filePath, 'utf-8');
      this.lines = this.content.split(/\r?\n/);

      // 3. 基本格式检查
      this.validateBasicFormat(result);

      // 4. 表头检查
      this.validateHeaders(result);

      // 5. 数据行检查
      this.validateDataRows(result);

      // 6. 统计信息
      this.calculateStats(result);

    } catch (error) {
      result.errors.push(`文件读取错误: ${error.message}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * 基本格式检查
   */
  private validateBasicFormat(result: ValidationResult): void {
    // 检查文件大小
    const stats = fs.statSync(this.filePath);
    if (stats.size === 0) {
      result.errors.push('文件为空');
      result.isValid = false;
      return;
    }

    if (stats.size > 10 * 1024 * 1024) { // 10MB
      result.warnings.push('文件过大，可能影响处理性能');
    }

    // 检查行数
    if (this.lines.length < 2) {
      result.errors.push('文件至少需要2行（表头 + 数据）');
      result.isValid = false;
      return;
    }

    // 检查编码（简单检查是否包含中文）
    if (!/[\u4e00-\u9fa5]/.test(this.content)) {
      result.warnings.push('文件可能不包含中文字符，请检查编码');
    }
  }

  /**
   * 表头检查
   */
  private validateHeaders(result: ValidationResult): void {
    if (this.lines.length === 0) return;

    const headerLine = this.lines[0].trim();
    
    // 自动检测分隔符类型
    let separator = '\t';
    let expectedHeader = '中文名\t英文名\t价格';
    
    if (headerLine.includes(',') && !headerLine.includes('\t')) {
      separator = ',';
      expectedHeader = '中文名,英文名,价格';
      result.stats.separator = 'COMMA';
    } else if (headerLine.includes('\t')) {
      separator = '\t';
      expectedHeader = '中文名\t英文名\t价格';
      result.stats.separator = 'TAB';
    } else if (headerLine.includes(' ') && !headerLine.includes(',') && !headerLine.includes('\t')) {
      result.errors.push('检测到空格分隔符，请使用制表符(TAB)或逗号分隔');
      result.isValid = false;
      result.stats.separator = 'SPACE';
      return;
    }
    
    if (headerLine !== expectedHeader) {
      result.errors.push(`表头格式错误。期望: "${expectedHeader}"，实际: "${headerLine}"`);
      result.isValid = false;
    }

    // 保存检测到的分隔符供后续使用
    (this as any).detectedSeparator = separator;
  }

  /**
   * 数据行检查
   */
  private validateDataRows(result: ValidationResult): void {
    let validRowCount = 0;
    let emptyRowCount = 0;
    
    // 使用检测到的分隔符
    const separator = (this as any).detectedSeparator || '\t';

    for (let i = 1; i < this.lines.length; i++) {
      const line = this.lines[i].trim();
      
      // 跳过空行
      if (!line) {
        emptyRowCount++;
        continue;
      }

      const columns = line.split(separator).map(col => col.trim());
      const rowErrors: string[] = [];

      // 检查列数
      if (columns.length !== 3) {
        rowErrors.push(`第${i+1}行列数错误：期望3列，实际${columns.length}列`);
      } else {
        // 检查各列内容
        this.validateChineseName(columns[0], i + 1, rowErrors);
        this.validateEnglishName(columns[1], i + 1, rowErrors);
        this.validatePrice(columns[2], i + 1, rowErrors);
      }

      if (rowErrors.length > 0) {
        result.errors.push(...rowErrors);
        result.isValid = false;
      } else {
        validRowCount++;
      }
    }

    result.stats.validRows = validRowCount;
    result.stats.emptyRows = emptyRowCount;
    result.stats.totalRows = this.lines.length - 1; // 不包括表头
  }

  /**
   * 验证中文名
   */
  private validateChineseName(name: string, rowNum: number, errors: string[]): void {
    if (!name || !name.trim()) {
      errors.push(`第${rowNum}行中文名不能为空`);
      return;
    }

    if (name.length > 100) {
      errors.push(`第${rowNum}行中文名过长（超过100字符）`);
    }

    if (!/[\u4e00-\u9fa5]/.test(name)) {
      errors.push(`第${rowNum}行中文名应包含中文字符`);
    }
  }

  /**
   * 验证英文名
   */
  private validateEnglishName(name: string, rowNum: number, errors: string[]): void {
    if (!name || !name.trim()) {
      errors.push(`第${rowNum}行英文名不能为空`);
      return;
    }

    if (name.length > 200) {
      errors.push(`第${rowNum}行英文名过长（超过200字符）`);
    }

    if (/[\u4e00-\u9fa5]/.test(name)) {
      errors.push(`第${rowNum}行英文名不应包含中文字符`);
    }
  }

  /**
   * 验证价格
   */
  private validatePrice(price: string, rowNum: number, errors: string[]): void {
    if (!price || !price.trim()) {
      errors.push(`第${rowNum}行价格不能为空`);
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) {
      errors.push(`第${rowNum}行价格格式错误：${price}`);
      return;
    }

    if (numPrice < 0.001) {
      errors.push(`第${rowNum}行价格过低（小于0.001）：${price}`);
    }

    if (numPrice > 1000) {
      errors.push(`第${rowNum}行价格过高（大于1000）：${price}`);
    }
  }

  /**
   * 计算统计信息
   */
  private calculateStats(result: ValidationResult): void {
    // 统计信息已在validateDataRows中计算
  }
}

/**
 * 格式化验证结果
 */
function formatValidationResult(result: ValidationResult): string {
  let output = '\n=== CSV文件验证结果 ===\n\n';

  // 基本信息
  output += `📊 统计信息:\n`;
  output += `   总行数: ${result.stats.totalRows}\n`;
  output += `   有效行数: ${result.stats.validRows}\n`;
  output += `   空行数: ${result.stats.emptyRows}\n`;
  output += `   编码: ${result.stats.encoding}\n`;
  output += `   分隔符: ${result.stats.separator}\n\n`;

  // 验证状态
  if (result.isValid) {
    output += `✅ 验证通过！文件格式符合要求。\n\n`;
  } else {
    output += `❌ 验证失败！请修复以下问题：\n\n`;
  }

  // 错误信息
  if (result.errors.length > 0) {
    output += `🔴 错误 (${result.errors.length}个):\n`;
    result.errors.forEach((error, index) => {
      output += `   ${index + 1}. ${error}\n`;
    });
    output += '\n';
  }

  // 警告信息
  if (result.warnings.length > 0) {
    output += `🟡 警告 (${result.warnings.length}个):\n`;
    result.warnings.forEach((warning, index) => {
      output += `   ${index + 1}. ${warning}\n`;
    });
    output += '\n';
  }

  // 处理建议
  if (!result.isValid) {
    output += `💡 修复建议:\n`;
    output += `   1. 确保文件编码为UTF-8\n`;
    output += `   2. 使用制表符(TAB)分隔，不是逗号或空格\n`;
    output += `   3. 表头必须是: 中文名	英文名	价格\n`;
    output += `   4. 检查数据格式，确保无空值\n`;
         output += `   5. 价格应为0.001-1000之间的数字\n\n`;
  }

  return output;
}

/**
 * 主函数
 */
function main(): void {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 CSV文件格式验证工具\n');
    console.log('用法: npx tsx validate-csv.ts <文件路径>');
    console.log('\n示例:');
    console.log('  npx tsx validate-csv.ts user-data/medicine-data-450.tsv');
    console.log('  npx tsx validate-csv.ts user-data/medicine-data-template.tsv');
    process.exit(1);
  }

  const filePath = args[0];
  console.log(`🔍 正在验证文件: ${filePath}\n`);

  const validator = new CSVValidator(filePath);
  const result = validator.validate();
  
  console.log(formatValidationResult(result));

  // 退出代码
  process.exit(result.isValid ? 0 : 1);
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

export { CSVValidator, ValidationResult }; 