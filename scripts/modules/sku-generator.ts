#!/usr/bin/env tsx

import { pinyin } from 'pinyin-pro';
import { logger } from '../utils/logger.js';

/**
 * SKU生成器 - 重新设计版本
 * 规则：汉字拼音首字母大写组合，冲突时使用完整拼音名
 */
export class SkuGenerator {
  private skuRegistry: Set<string> = new Set();

  /**
   * 生成SKU代码
   * @param chineseName 中文名称（主要依据）
   * @param pinyinName 拼音名称（备用方案）
   * @returns SKU生成结果
   */
  generateSku(chineseName: string, pinyinName: string): {
    success: boolean;
    sku: string;
    method: 'initials' | 'fullPinyin' | 'fallback';
    warnings?: string[];
  } {
    logger.debug(`生成SKU: ${chineseName} (${pinyinName})`);

    if (!chineseName || chineseName.trim() === '') {
      return {
        success: false,
        sku: pinyinName || 'unknown',
        method: 'fallback',
        warnings: ['中文名为空，使用拼音名作为SKU']
      };
    }

    if (!pinyinName || pinyinName.trim() === '') {
      return {
        success: false,
        sku: 'unknown',
        method: 'fallback',
        warnings: ['拼音名为空']
      };
    }

    const warnings: string[] = [];

    try {
      // 方案1：提取汉字拼音首字母大写组合
      const initialsSku = this.extractInitials(chineseName.trim());
      
      if (initialsSku && this.isValidSku(initialsSku)) {
        // 检查是否已存在
        if (!this.skuRegistry.has(initialsSku)) {
          this.skuRegistry.add(initialsSku);
          return {
            success: true,
            sku: initialsSku,
            method: 'initials'
          };
        } else {
          warnings.push(`首字母组合 "${initialsSku}" 已存在冲突`);
        }
      } else {
        warnings.push('首字母提取失败或无效');
      }

      // 方案2：冲突时使用完整拼音名
      const cleanPinyinSku = this.cleanPinyinSku(pinyinName.trim());
      
      if (!this.skuRegistry.has(cleanPinyinSku)) {
        this.skuRegistry.add(cleanPinyinSku);
        return {
          success: true,
          sku: cleanPinyinSku,
          method: 'fullPinyin',
          warnings
        };
      } else {
        warnings.push(`完整拼音 "${cleanPinyinSku}" 也已存在冲突`);
      }

      // 方案3：备用方案（添加序号）
      const fallbackSku = this.generateFallbackSku(cleanPinyinSku);
      this.skuRegistry.add(fallbackSku);
      
      return {
        success: false,
        sku: fallbackSku,
        method: 'fallback',
        warnings: [...warnings, '使用备用方案']
      };

    } catch (error) {
      logger.warn(`SKU生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
      
      const fallbackSku = this.generateFallbackSku(pinyinName);
      this.skuRegistry.add(fallbackSku);
      
      return {
        success: false,
        sku: fallbackSku,
        method: 'fallback',
        warnings: [`生成失败: ${error instanceof Error ? error.message : '未知错误'}`]
      };
    }
  }

  /**
   * 提取汉字拼音首字母大写组合
   * 例：五指毛桃 → ['五','指','毛','桃'] → ['wu','zhi','mao','tao'] → ['W','Z','M','T'] → 'WZMT'
   */
  private extractInitials(chineseName: string): string {
    try {
      // 过滤出中文字符
      const cleanName = chineseName.replace(/[^\u4e00-\u9fff]/g, '');
      
      if (cleanName.length === 0) {
        logger.warn(`没有发现中文字符: ${chineseName}`);
        return '';
      }

      // 先尝试整体转换（考虑上下文，如"人参"）
      const wholePinyinArray = pinyin(cleanName, {
        toneType: 'none',
        type: 'array'
      });

      if (wholePinyinArray && wholePinyinArray.length > 0) {
        const initials = wholePinyinArray.map(pinyinStr => {
          if (pinyinStr && pinyinStr.length > 0) {
            return pinyinStr[0].toUpperCase();
          } else {
            return 'X';
          }
        });

        const result = initials.join('');
        logger.debug(`首字母提取: ${chineseName} → 整体拼音 ${JSON.stringify(wholePinyinArray)} → [${initials.join(',')}] → ${result}`);
        
        return result;
      }

      // 备用方案：逐字转换
      const chars = Array.from(cleanName);
      const initials = chars.map(char => {
        const pinyinResult = pinyin(char, {
          toneType: 'none',
          type: 'string',
          nonZh: 'removed'
        });
        
        if (pinyinResult && pinyinResult.length > 0) {
          const firstChar = pinyinResult.trim()[0];
          return firstChar ? firstChar.toUpperCase() : 'X';
        } else {
          logger.warn(`字符拼音转换失败: ${char}`);
          return 'X';
        }
      });

      const result = initials.join('');
      logger.debug(`首字母提取(备用): ${chineseName} → [${chars.join(',')}] → [${initials.join(',')}] → ${result}`);
      
      return result;

    } catch (error) {
      logger.warn(`首字母提取失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return '';
    }
  }

  /**
   * 清理拼音SKU格式
   */
  private cleanPinyinSku(pinyinName: string): string {
    return pinyinName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // 只保留字母和数字
      .trim();
  }

  /**
   * 验证SKU是否有效
   */
  private isValidSku(sku: string): boolean {
    if (!sku || sku.length === 0) {
      return false;
    }
    
    // SKU应该是字母数字组合，2-10位
    const pattern = /^[A-Z0-9]{2,10}$/;
    return pattern.test(sku);
  }

  /**
   * 生成备用SKU（添加数字后缀）
   */
  private generateFallbackSku(baseSku: string): string {
    let counter = 1;
    let fallbackSku = '';
    
    do {
      fallbackSku = `${baseSku}${counter}`;
      counter++;
    } while (this.skuRegistry.has(fallbackSku) && counter <= 999);
    
    return fallbackSku;
  }

  /**
   * 批量生成SKU
   */
  batchGenerate(
    chineseNames: string[], 
    pinyinNames: string[]
  ): {
    results: Array<{
      chineseName: string;
      pinyinName: string;
      sku: string;
      success: boolean;
      method: string;
      warnings?: string[];
    }>;
    stats: {
      total: number;
      success: number;
      failed: number;
      byMethod: Record<string, number>;
      duplicates: number;
    };
  } {
    if (chineseNames.length !== pinyinNames.length) {
      throw new Error('中文名和拼音名数组长度不匹配');
    }

    const results: Array<{
      chineseName: string;
      pinyinName: string;
      sku: string;
      success: boolean;
      method: string;
      warnings?: string[];
    }> = [];

    const stats = {
      total: chineseNames.length,
      success: 0,
      failed: 0,
      byMethod: {} as Record<string, number>,
      duplicates: 0
    };

    for (let i = 0; i < chineseNames.length; i++) {
      const chineseName = chineseNames[i];
      const pinyinName = pinyinNames[i];
      
      const result = this.generateSku(chineseName, pinyinName);
      
      results.push({
        chineseName,
        pinyinName,
        sku: result.sku,
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

      // 检查重复（这里应该不会有重复，因为我们有注册表）
      const duplicateCount = results.filter(r => r.sku === result.sku).length;
      if (duplicateCount > 1) {
        stats.duplicates++;
        logger.warn(`发现重复SKU: ${result.sku}`);
      }

      if (i % 50 === 0 || i === chineseNames.length - 1) {
        logger.progress(i + 1, chineseNames.length, `生成SKU进度`);
      }
    }

    return { results, stats };
  }

  /**
   * 检查SKU是否已存在
   */
  exists(sku: string): boolean {
    return this.skuRegistry.has(sku);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalSkus: number;
    initialsCount: number;
    fullPinyinCount: number;
    fallbackCount: number;
  } {
    return {
      totalSkus: this.skuRegistry.size,
      initialsCount: Array.from(this.skuRegistry).filter(sku => /^[A-Z]{2,6}$/.test(sku)).length,
      fullPinyinCount: Array.from(this.skuRegistry).filter(sku => /^[a-z]+$/.test(sku)).length,
      fallbackCount: Array.from(this.skuRegistry).filter(sku => /[0-9]/.test(sku)).length
    };
  }

  /**
   * 重置SKU注册表
   */
  reset(): void {
    this.skuRegistry.clear();
  }

  /**
   * 预览SKU生成（不实际注册）
   */
  previewSku(chineseName: string, pinyinName: string): {
    proposedInitials: string;
    proposedFullPinyin: string;
    conflicts: {
      initialsConflict: boolean;
      fullPinyinConflict: boolean;
    };
  } {
    const proposedInitials = this.extractInitials(chineseName);
    const proposedFullPinyin = this.cleanPinyinSku(pinyinName);
    
    return {
      proposedInitials,
      proposedFullPinyin,
      conflicts: {
        initialsConflict: this.skuRegistry.has(proposedInitials),
        fullPinyinConflict: this.skuRegistry.has(proposedFullPinyin)
      }
    };
  }
} 