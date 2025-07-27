#!/usr/bin/env tsx

import { pinyin } from 'pinyin-pro';
import { PinyinConfig } from '../types/medicine-types.js';
import { logger } from '../utils/logger.js';

/**
 * 拼音生成器
 * 使用pinyin-pro库实现高精度中药名拼音转换
 */
export class PinyinGenerator {
  private readonly config: PinyinConfig;
  
  // 中药常见炮制词汇
  private readonly processingTerms = [
    '炙', '蜜炙', '酒炙', '盐炙', '醋炙', '土炒', '麸炒', '清炒',
    '生', '熟', '制', '酒制', '醋制', '盐制', '姜制',
    '蒸', '煮', '炒', '烘', '晒', '阴干', '烫', '煅'
  ];

  // 中药常见规格词汇
  private readonly specificationTerms = [
    '片', '丝', '段', '块', '粉', '末', '粒', '丁',
    '丝', '条', '头', '尾', '根', '茎', '叶', '花', '果', '子',
    '皮', '壳', '心', '肉', '核', '仁'
  ];

  // 特殊拼音映射（解决多音字和专业术语）
  private readonly specialMappings: Record<string, string> = {
    '薄荷': 'bohe',           // 薄读作bò而非báo
    '厚朴': 'houpo',          // 朴读作pò而非pǔ
    '杜仲': 'duzhong',        // 仲读作zhòng
    '枸杞': 'gouqi',          // 枸读作gǒu而非jǔ
    '牛膝': 'niuxi',          // 常见中药
    '车前': 'cheqian',        // 车读作chē而非jū
    '知母': 'zhimu',          // 母读作mǔ
    '浙贝': 'zheibei',        // 贝读作bèi
    '川贝': 'chuanbei',       // 川贝母的简称
    '藏红花': 'zanghonghua',   // 藏读作zàng
    '番泻叶': 'fanxieye',      // 番读作fān
    '诃子': 'hezi',           // 诃读作hē
    '没药': 'moyao',          // 没读作mò
    '乳香': 'ruxiang',        // 专业术语
    '血竭': 'xuejie',         // 血读作xuè
    '阿胶': 'ajiao',          // 阿读作ē
    '龟板': 'guiban',         // 龟读作guī
    '鳖甲': 'biejia',         // 鳖读作biē
    '蛤蚧': 'gejie',          // 特殊读音
    '海马': 'haima',          // 常见中药
    '石决明': 'shijueming',    // 决读作jué
    '夜明砂': 'yemingsha',     // 专业术语
    '五倍子': 'wubeizi',       // 倍读作bèi
    '五加皮': 'wujiapi',       // 加读作jiā
    '五味子': 'wuweizi',       // 味读作wèi
    '五指毛桃': 'wuzhimoutao',  // 完整词组
    '仙茅': 'xianmao',        // 茅读作máo
    '佛手': 'foshou'          // 佛读作fó
  };

  constructor(config?: Partial<PinyinConfig>) {
    this.config = {
      removeTone: true,
      separator: '',
      lowercase: true,
      ...config
    };
  }

  /**
   * 生成拼音名称
   */
  generatePinyin(chineseName: string): {
    success: boolean;
    pinyin: string;
    method: 'special' | 'processed' | 'direct' | 'fallback';
    warnings?: string[];
  } {
    logger.debug(`生成拼音: ${chineseName}`);

    if (!chineseName || chineseName.trim() === '') {
      return {
        success: false,
        pinyin: '',
        method: 'fallback',
        warnings: ['输入为空']
      };
    }

    const trimmedName = chineseName.trim();
    const warnings: string[] = [];

    try {
      // 1. 检查特殊映射
      if (this.specialMappings[trimmedName]) {
        logger.debug(`使用特殊映射: ${trimmedName} -> ${this.specialMappings[trimmedName]}`);
        return {
          success: true,
          pinyin: this.specialMappings[trimmedName],
          method: 'special'
        };
      }

      // 2. 使用pinyin-pro生成拼音
      const pinyinResult = pinyin(trimmedName, {
        toneType: this.config.removeTone ? 'none' : 'symbol',
        type: 'string',
        nonZh: 'consecutive'
      });

      // 3. 清理和格式化
      let cleaned = pinyinResult
        .replace(/\s+/g, this.config.separator)
        .replace(/['"]/g, '')
        .trim();

      if (this.config.lowercase) {
        cleaned = cleaned.toLowerCase();
      }

      // 4. 验证生成的拼音质量
      const validation = this.validatePinyin(cleaned, trimmedName);
      if (!validation.isValid) {
        warnings.push(validation.warning || '拼音质量检查失败');
      }

      return {
        success: true,
        pinyin: cleaned,
        method: 'direct',
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      logger.warn(`拼音生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
      
      // 备用方案
      const fallbackPinyin = this.generateFallbackPinyin(trimmedName);
      
      return {
        success: false,
        pinyin: fallbackPinyin,
        method: 'fallback',
        warnings: [`主要方法失败，使用备用方案: ${error instanceof Error ? error.message : '未知错误'}`]
      };
    }
  }

  /**
   * 验证拼音质量
   */
  private validatePinyin(pinyin: string, originalName: string): {
    isValid: boolean;
    warning?: string;
  } {
    if (!pinyin || pinyin.trim() === '') {
      return { isValid: false, warning: '拼音为空' };
    }

    if (pinyin.length > originalName.length * 10) {
      return { isValid: false, warning: '拼音长度异常' };
    }

    const allowedPattern = /^[a-zA-Z0-9\-_]*$/;
    if (!allowedPattern.test(pinyin)) {
      return { isValid: false, warning: '拼音包含非法字符' };
    }

    if (originalName.length >= 2 && pinyin.length < 2) {
      return { isValid: false, warning: '拼音过短，可能转换失败' };
    }

    return { isValid: true };
  }

  /**
   * 备用拼音生成方案
   */
  private generateFallbackPinyin(name: string): string {
    const fallbackMap: Record<string, string> = {
      '当': 'dang', '归': 'gui', '川': 'chuan', '芎': 'xiong',
      '白': 'bai', '芍': 'shao', '熟': 'shu', '地': 'di',
      '黄': 'huang', '人': 'ren', '参': 'shen', '党': 'dang',
      '甘': 'gan', '草': 'cao', '陈': 'chen', '皮': 'pi'
    };

    let result = '';
    for (const char of name) {
      if (fallbackMap[char]) {
        result += fallbackMap[char];
      } else {
        result += char.charCodeAt(0).toString(36);
      }
    }

    return result || 'unknown';
  }

  /**
   * 批量生成拼音
   */
  batchGenerate(names: string[]): {
    results: Array<{
      input: string;
      output: string;
      success: boolean;
      method: string;
      warnings?: string[];
    }>;
    stats: {
      total: number;
      success: number;
      failed: number;
      byMethod: Record<string, number>;
    };
  } {
    const results: Array<{
      input: string;
      output: string;
      success: boolean;
      method: string;
      warnings?: string[];
    }> = [];

    const stats = {
      total: names.length,
      success: 0,
      failed: 0,
      byMethod: {} as Record<string, number>
    };

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const result = this.generatePinyin(name);
      
      results.push({
        input: name,
        output: result.pinyin,
        success: result.success,
        method: result.method,
        warnings: result.warnings
      });

      if (result.success) {
        stats.success++;
      } else {
        stats.failed++;
      }

      stats.byMethod[result.method] = (stats.byMethod[result.method] || 0) + 1;

      if (i % 20 === 0 || i === names.length - 1) {
        logger.progress(i + 1, names.length, `生成拼音进度`);
      }
    }

    return { results, stats };
  }

  /**
   * 获取特殊映射词典大小
   */
  getSpecialMappingsCount(): number {
    return Object.keys(this.specialMappings).length;
  }
} 