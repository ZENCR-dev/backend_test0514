#!/usr/bin/env tsx

/**
 * 中药数据处理类型定义
 * 支持TSV输入格式和完整数据库字段输出
 */

// ==================== 输入数据类型 ====================

/**
 * 用户上传的TSV文件中的原始数据
 */
export interface InputMedicineData {
  /** 中文名称 */
  chineseName: string;
  /** 英文名称（用户提供） */
  englishName: string;
  /** 每克价格 */
  pricePerGram: number;
}

// ==================== 处理过程类型 ====================

/**
 * 处理过程中的扩展数据
 */
export interface ProcessingMedicineData extends InputMedicineData {
  /** 生成的拼音名称 */
  pinyinName: string;
  /** 生成的SKU代码 */
  sku: string;
  /** 处理索引（用于排序和错误追踪） */
  index: number;
}

/**
 * 完整的药品数据（匹配数据库schema）
 */
export interface CompleteMedicineData {
  /** 名称（通常等同于中文名） */
  name: string;
  /** 中文名称 */
  chineseName?: string;
  /** 英文名称 */
  englishName?: string;
  /** 拼音名称 */
  pinyinName?: string;
  /** SKU代码 */
  sku: string;
  /** 描述 */
  description?: string;
  /** 分类 */
  category?: string;
  /** 单位 */
  unit: string;
  /** 是否需要处方 */
  requiresPrescription: boolean;
  /** 基础价格 */
  basePrice: number;
  /** 元数据 */
  metadata?: any;
  /** 状态 */
  status: string;
}

// ==================== 处理结果类型 ====================

/**
 * 单个记录的处理结果
 */
export interface ProcessingResult {
  /** 是否成功 */
  success: boolean;
  /** 原始数据 */
  input: InputMedicineData;
  /** 处理后数据（成功时） */
  output?: CompleteMedicineData;
  /** 错误信息（失败时） */
  error?: string;
  /** 警告信息 */
  warnings?: string[];
  /** 处理索引 */
  index: number;
}

/**
 * 批处理结果
 */
export interface BatchProcessingResult {
  /** 总记录数 */
  totalRecords: number;
  /** 成功处理数 */
  successCount: number;
  /** 失败记录数 */
  failureCount: number;
  /** 警告记录数 */
  warningCount: number;
  /** 所有处理结果 */
  results: ProcessingResult[];
  /** 处理开始时间 */
  startTime: Date;
  /** 处理结束时间 */
  endTime: Date;
  /** 处理耗时（毫秒） */
  duration: number;
}

// ==================== 配置类型 ====================

/**
 * 拼音生成配置
 */
export interface PinyinConfig {
  /** 是否移除声调 */
  removeTone: boolean;
  /** 分隔符 */
  separator: string;
  /** 是否转换为小写 */
  lowercase: boolean;
}

/**
 * SKU生成配置
 */
export interface SkuConfig {
  /** 前缀 */
  prefix: string;
  /** 最小前缀长度 */
  minPrefixLength: number;
  /** 最大前缀长度 */
  maxPrefixLength: number;
  /** 序号位数 */
  numberLength: number;
}

/**
 * 脚本运行配置
 */
export interface ScriptConfig {
  /** 输入文件路径 */
  inputFile: string;
  /** 输出目录 */
  outputDir: string;
  /** 是否预览模式 */
  previewMode: boolean;
  /** 输出格式 */
  outputFormats: ('csv' | 'json')[];
  /** 是否生成详细报告 */
  generateReport: boolean;
  /** 拼音配置 */
  pinyinConfig: PinyinConfig;
  /** SKU配置 */
  skuConfig: SkuConfig;
}

// ==================== 日志和错误类型 ====================

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 日志记录
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: any;
}

/**
 * 处理错误类型
 */
export class MedicineProcessingError extends Error {
  constructor(
    message: string,
    public readonly recordIndex: number,
    public readonly originalData: InputMedicineData,
    public readonly stage: 'parsing' | 'pinyin' | 'sku' | 'validation' | 'output'
  ) {
    super(message);
    this.name = 'MedicineProcessingError';
  }
}

// ==================== 统计类型 ====================

/**
 * SKU统计信息
 */
export interface SkuStats {
  /** 总数 */
  total: number;
  /** 唯一数量 */
  unique: number;
  /** 冲突数量 */
  conflicts: number;
  /** 前缀分布 */
  prefixDistribution: Record<string, number>;
}

/**
 * 拼音统计信息
 */
export interface PinyinStats {
  /** 总数 */
  total: number;
  /** 平均长度 */
  averageLength: number;
  /** 最长拼音 */
  longest: string;
  /** 最短拼音 */
  shortest: string;
  /** 字符分布 */
  characterDistribution: Record<string, number>;
}

/**
 * 处理统计报告
 */
export interface ProcessingStats {
  /** SKU统计 */
  sku: SkuStats;
  /** 拼音统计 */
  pinyin: PinyinStats;
  /** 价格统计 */
  price: {
    min: number;
    max: number;
    average: number;
    median: number;
  };
  /** 分类统计 */
  categories: Record<string, number>;
}

// ==================== 验证结果类型 ====================

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 错误列表 */
  errors: string[];
  /** 警告列表 */
  warnings: string[];
  /** 统计摘要 */
  summary: {
    valid: number;
    invalid: number;
    total: number;
  };
} 