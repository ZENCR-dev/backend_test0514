#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { 
  InputMedicineData, 
  MedicineProcessingError,
  ProcessingResult 
} from '../types/medicine-types.js';
import { logger } from '../utils/logger.js';

/**
 * CSV/TSV文件解析器
 * 支持逗号和制表符分隔文件读取、UTF-8编码、表头验证和错误处理
 */
export class TsvParser {
  private readonly expectedHeaders = ['中文名', '英文名', '价格'];
  
  /**
   * 解析CSV/TSV文件
   * @param filePath 文件路径
   * @returns 解析结果，包含成功和失败的记录
   */
  async parseFile(filePath: string): Promise<{
    data: InputMedicineData[];
    errors: ProcessingResult[];
    stats: {
      totalRows: number;
      successRows: number;
      errorRows: number;
    };
  }> {
    logger.info(`开始解析CSV/TSV文件: ${filePath}`);
    
    // 1. 文件存在性检查
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    // 2. 文件大小检查
    const stats = fs.statSync(filePath);
    logger.info(`文件大小: ${this.formatFileSize(stats.size)}`);

    // 3. 读取文件内容
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`文件读取失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    // 4. 自动检测分隔符
    const delimiter = this.detectDelimiter(content);
    logger.info(`检测到分隔符: ${delimiter === ',' ? '逗号' : '制表符'}`);

    // 5. 解析CSV内容
    let rawRows: string[][];
    try {
      rawRows = parse(content, {
        delimiter: delimiter,  // 自动检测的分隔符
        trim: true,      // 去除空白字符
        skip_empty_lines: true,  // 跳过空行
        columns: false,  // 不使用第一行作为列名，手动处理
        relax_quotes: true,  // 允许引号不匹配
        escape: '\\',    // 转义字符
        quote: '"'       // 引号字符
      });
    } catch (error) {
      throw new Error(`文件解析失败: ${error instanceof Error ? error.message : '解析错误'}`);
    }

    logger.info(`读取到 ${rawRows.length} 行数据（包含表头）`);

    // 6. 验证表头
    if (rawRows.length === 0) {
      throw new Error('文件为空');
    }

    const headerValidation = this.validateHeaders(rawRows[0]);
    if (!headerValidation.isValid) {
      throw new Error(`表头验证失败: ${headerValidation.error}`);
    }

    // 7. 处理数据行
    const dataRows = rawRows.slice(1); // 跳过表头
    const results = this.processDataRows(dataRows);

    const successData = results.filter(r => r.success).map(r => r.input);
    const errorResults = results.filter(r => !r.success);

    logger.success(`解析完成: 成功 ${successData.length} 条，失败 ${errorResults.length} 条`);

    return {
      data: successData,
      errors: errorResults,
      stats: {
        totalRows: dataRows.length,
        successRows: successData.length,
        errorRows: errorResults.length
      }
    };
  }

  /**
   * 验证表头格式
   */
  private validateHeaders(headers: string[]): { isValid: boolean; error?: string } {
    logger.debug(`验证表头: ${JSON.stringify(headers)}`);

    if (headers.length !== 3) {
      return {
        isValid: false,
        error: `预期3列，实际${headers.length}列: ${JSON.stringify(headers)}`
      };
    }

    // 检查必要的列是否存在（顺序可以不同）
    const normalizedHeaders = headers.map(h => h.trim());
    const missingColumns: string[] = [];

    for (const expectedHeader of this.expectedHeaders) {
      const found = normalizedHeaders.some(h => 
        h === expectedHeader || 
        h.includes(expectedHeader) || 
        expectedHeader.includes(h)
      );
      
      if (!found) {
        missingColumns.push(expectedHeader);
      }
    }

    if (missingColumns.length > 0) {
      return {
        isValid: false,
        error: `缺少必要列: ${missingColumns.join(', ')}`
      };
    }

    logger.debug('表头验证通过');
    return { isValid: true };
  }

  /**
   * 处理数据行
   */
  private processDataRows(rows: string[][]): ProcessingResult[] {
    const results: ProcessingResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2; // +2 因为表头占第1行，数组从0开始

      try {
        // 验证列数
        if (row.length !== 3) {
          throw new Error(`列数不正确，预期3列，实际${row.length}列`);
        }

        // 提取和验证数据
        const [chineseName, englishName, priceStr] = row.map(cell => cell.trim());

        // 验证中文名
        if (!chineseName) {
          throw new Error('中文名不能为空');
        }

        if (chineseName.length > 100) {
          throw new Error('中文名长度不能超过100个字符');
        }

        // 验证英文名
        if (!englishName) {
          throw new Error('英文名不能为空');
        }

        if (englishName.length > 255) {
          throw new Error('英文名长度不能超过255个字符');
        }

        // 验证价格
        if (!priceStr) {
          throw new Error('价格不能为空');
        }

        const pricePerGram = parseFloat(priceStr);
        if (isNaN(pricePerGram)) {
          throw new Error(`价格格式无效: "${priceStr}"`);
        }

        if (pricePerGram < 0) {
          throw new Error(`价格不能为负数: ${pricePerGram}`);
        }

        if (pricePerGram < 0.001) {
          throw new Error(`价格过低（最小0.001）: ${pricePerGram}`);
        }

        if (pricePerGram > 10000) {
          throw new Error(`价格过高，请检查: ${pricePerGram}`);
        }

        // 创建成功结果
        const medicineData: InputMedicineData = {
          chineseName,
          englishName,
          pricePerGram
        };

        results.push({
          success: true,
          input: medicineData,
          index: rowIndex
        });

        if (i % 50 === 0) {
          logger.progress(i + 1, rows.length, `解析第 ${i + 1} 行`);
        }

      } catch (error) {
        // 创建错误结果
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        
        logger.warn(`第 ${rowIndex} 行解析失败: ${errorMessage}`);

        // 尝试创建部分有效的输入数据用于错误记录
        const partialData: InputMedicineData = {
          chineseName: row[0] || '无效数据',
          englishName: row[1] || '无效数据',
          pricePerGram: 0
        };

        results.push({
          success: false,
          input: partialData,
          error: errorMessage,
          index: rowIndex
        });
      }
    }

    // 完成进度显示
    if (rows.length > 0) {
      logger.progress(rows.length, rows.length, '解析完成');
    }

    return results;
  }

  /**
   * 自动检测分隔符
   */
  private detectDelimiter(content: string): string {
    // 取前几行进行检测
    const lines = content.split(/\r?\n/).slice(0, 5);
    
    let tabCount = 0;
    let commaCount = 0;
    
    for (const line of lines) {
      if (line.trim()) {
        tabCount += (line.match(/\t/g) || []).length;
        commaCount += (line.match(/,/g) || []).length;
      }
    }
    
    // 如果制表符数量更多，使用制表符
    if (tabCount > commaCount) {
      return '\t';
    }
    
    // 否则使用逗号
    return ',';
  }

  /**
   * 验证文件格式
   */
  validateFileFormat(filePath: string): { isValid: boolean; error?: string } {
    // 检查文件扩展名
    const ext = path.extname(filePath).toLowerCase();
    if (!['.tsv', '.csv', '.txt'].includes(ext)) {
      return {
        isValid: false,
        error: `不支持的文件格式: ${ext}，支持 .tsv, .csv, .txt`
      };
    }

    // 检查文件是否为空
    try {
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        return {
          isValid: false,
          error: '文件为空'
        };
      }

      // 检查文件大小（限制为10MB）
      if (stats.size > 10 * 1024 * 1024) {
        return {
          isValid: false,
          error: `文件过大: ${this.formatFileSize(stats.size)}，限制为10MB`
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error: `文件访问失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }

    return { isValid: true };
  }

  /**
   * 预览文件内容
   */
  async previewFile(filePath: string, maxRows: number = 5): Promise<{
    headers: string[];
    sampleRows: string[][];
    totalRows: number;
  }> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const delimiter = this.detectDelimiter(content);
    
    const allRows = parse(content, {
      delimiter: delimiter,
      trim: true,
      skip_empty_lines: true,
      columns: false
    });

    const headers = allRows[0] || [];
    const dataRows = allRows.slice(1);
    const sampleRows = dataRows.slice(0, maxRows);

    return {
      headers,
      sampleRows,
      totalRows: dataRows.length
    };
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 检测文件编码
   */
  detectEncoding(filePath: string): string {
    const buffer = fs.readFileSync(filePath);
    
    // 检查BOM
    if (buffer.length >= 3 && 
        buffer[0] === 0xEF && 
        buffer[1] === 0xBB && 
        buffer[2] === 0xBF) {
      return 'utf-8-bom';
    }

    // 简单的UTF-8检测
    try {
      const content = buffer.toString('utf-8');
      // 检查是否包含替换字符（表示编码错误）
      if (!content.includes('\uFFFD')) {
        return 'utf-8';
      }
    } catch (error) {
      // UTF-8解码失败
    }

    // 如果UTF-8检测失败，假设为其他编码
    return 'unknown';
  }
} 