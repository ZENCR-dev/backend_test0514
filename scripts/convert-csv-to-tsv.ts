#!/usr/bin/env node

/**
 * CSV到TSV转换工具
 * 将逗号分隔的CSV文件转换为制表符分隔的TSV文件
 */

import * as fs from 'fs';
import * as path from 'path';

interface ConvertResult {
  success: boolean;
  inputFile: string;
  outputFile: string;
  totalRows: number;
  errors: string[];
}

class CSVToTSVConverter {
  private inputPath: string;
  private outputPath: string;

  constructor(inputPath: string, outputPath?: string) {
    this.inputPath = inputPath;
    // 如果没有指定输出路径，自动生成
    this.outputPath = outputPath || this.generateOutputPath(inputPath);
  }

  /**
   * 生成输出文件路径
   */
  private generateOutputPath(inputPath: string): string {
    const dir = path.dirname(inputPath);
    const basename = path.basename(inputPath, path.extname(inputPath));
    return path.join(dir, `${basename}.tsv`);
  }

  /**
   * 转换文件
   */
  convert(): ConvertResult {
    const result: ConvertResult = {
      success: false,
      inputFile: this.inputPath,
      outputFile: this.outputPath,
      totalRows: 0,
      errors: []
    };

    try {
      // 检查输入文件是否存在
      if (!fs.existsSync(this.inputPath)) {
        result.errors.push(`输入文件不存在: ${this.inputPath}`);
        return result;
      }

      // 读取CSV内容
      const content = fs.readFileSync(this.inputPath, 'utf-8');
      const lines = content.split(/\r?\n/);

      if (lines.length === 0) {
        result.errors.push('文件为空');
        return result;
      }

      // 转换每一行
      const convertedLines: string[] = [];
      let processedRows = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 跳过空行
        if (!line) {
          if (i < lines.length - 1) { // 不是最后一行
            convertedLines.push('');
          }
          continue;
        }

        // 解析CSV行（简单解析，假设没有引号包含的逗号）
        const convertedLine = this.convertCSVLineToTSV(line, i + 1, result.errors);
        if (convertedLine !== null) {
          convertedLines.push(convertedLine);
          processedRows++;
        }
      }

      // 写入TSV文件
      const tsvContent = convertedLines.join('\n');
      fs.writeFileSync(this.outputPath, tsvContent, 'utf-8');

      result.success = result.errors.length === 0;
      result.totalRows = processedRows;

      if (result.success) {
        console.log(`✅ 转换成功！`);
        console.log(`   输入: ${this.inputPath}`);
        console.log(`   输出: ${this.outputPath}`);
        console.log(`   行数: ${processedRows}`);
      }

    } catch (error) {
      result.errors.push(`转换失败: ${error.message}`);
    }

    return result;
  }

  /**
   * 转换单行CSV到TSV
   */
  private convertCSVLineToTSV(line: string, lineNum: number, errors: string[]): string | null {
    try {
      // 简单的CSV解析（适用于没有引号包含逗号的情况）
      const columns = line.split(',').map(col => col.trim());

      // 验证列数
      if (lineNum === 1) { // 表头
        if (columns.length !== 3) {
          errors.push(`第${lineNum}行（表头）列数错误：期望3列，实际${columns.length}列`);
          return null;
        }
        
        // 验证表头内容
        const expectedHeaders = ['中文名', '英文名', '价格'];
        for (let i = 0; i < 3; i++) {
          if (columns[i] !== expectedHeaders[i]) {
            console.warn(`⚠️ 表头第${i+1}列可能有问题：期望"${expectedHeaders[i]}"，实际"${columns[i]}"`);
          }
        }
      } else { // 数据行
        if (columns.length !== 3) {
          errors.push(`第${lineNum}行列数错误：期望3列，实际${columns.length}列`);
          return null;
        }

        // 基本数据验证
        if (!columns[0]) {
          errors.push(`第${lineNum}行中文名为空`);
        }
        if (!columns[1]) {
          errors.push(`第${lineNum}行英文名为空`);
        }
        if (!columns[2] || isNaN(parseFloat(columns[2]))) {
          errors.push(`第${lineNum}行价格格式错误: ${columns[2]}`);
        }
      }

      // 转换为TSV格式（制表符分隔）
      return columns.join('\t');

    } catch (error) {
      errors.push(`第${lineNum}行解析错误: ${error.message}`);
      return null;
    }
  }
}

/**
 * 主函数
 */
function main(): void {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🔄 CSV到TSV转换工具\n');
    console.log('用法: npx tsx convert-csv-to-tsv.ts <输入CSV文件> [输出TSV文件]');
    console.log('\n示例:');
    console.log('  npx tsx convert-csv-to-tsv.ts user-data/medicine-data-450.CSV');
    console.log('  npx tsx convert-csv-to-tsv.ts user-data/data.csv user-data/data.tsv');
    console.log('\n注意：');
    console.log('  - 输入文件必须是逗号分隔的CSV格式');
    console.log('  - 输出文件将使用制表符分隔（TSV格式）');
    console.log('  - 如果不指定输出文件，将自动生成.tsv文件');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1];

  console.log(`🔄 开始转换: ${inputFile}\n`);

  const converter = new CSVToTSVConverter(inputFile, outputFile);
  const result = converter.convert();

  if (result.success) {
    console.log(`\n🎉 转换完成！可以使用以下命令验证格式：`);
    console.log(`npx tsx validate-csv.ts "${result.outputFile}"`);
    console.log(`\n或直接处理数据：`);
    console.log(`npx tsx process-medicines.ts "${result.outputFile}" --output results`);
  } else {
    console.log(`\n❌ 转换失败，错误信息：`);
    result.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
    console.log(`\n💡 请检查输入文件格式是否正确。`);
  }

  process.exit(result.success ? 0 : 1);
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

export { CSVToTSVConverter, ConvertResult }; 