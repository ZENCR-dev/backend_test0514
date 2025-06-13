#!/usr/bin/env tsx

import * as chalk from 'chalk';
import { LogLevel, LogEntry } from '../types/medicine-types.js';

/**
 * 彩色日志工具类
 * 支持不同级别的日志输出和格式化
 */
export class Logger {
  private logs: LogEntry[] = [];
  private enableConsole: boolean;

  constructor(enableConsole: boolean = true) {
    this.enableConsole = enableConsole;
  }

  /**
   * 输出调试信息
   */
  debug(message: string, context?: any): void {
    this.log('debug', message, context);
  }

  /**
   * 输出一般信息
   */
  info(message: string, context?: any): void {
    this.log('info', message, context);
  }

  /**
   * 输出警告信息
   */
  warn(message: string, context?: any): void {
    this.log('warn', message, context);
  }

  /**
   * 输出错误信息
   */
  error(message: string, context?: any): void {
    this.log('error', message, context);
  }

  /**
   * 输出成功信息
   */
  success(message: string, context?: any): void {
    this.log('info', `✅ ${message}`, context);
  }

  /**
   * 输出处理进度
   */
  progress(current: number, total: number, message?: string): void {
    const percentage = Math.round((current / total) * 100);
    const progressBar = this.createProgressBar(percentage);
    const defaultMessage = `处理进度: ${current}/${total}`;
    this.log('info', `${progressBar} ${message || defaultMessage}`, { current, total, percentage });
  }

  /**
   * 输出分隔线
   */
  separator(title?: string): void {
    const line = '='.repeat(60);
    if (title) {
      const padding = Math.max(0, (60 - title.length - 2) / 2);
      const paddedTitle = ' '.repeat(Math.floor(padding)) + title + ' '.repeat(Math.ceil(padding));
      this.log('info', chalk.cyan(`${paddedTitle}`));
    } else {
      this.log('info', chalk.gray(line));
    }
  }

  /**
   * 输出表格数据
   */
  table(headers: string[], rows: string[][]): void {
    if (!this.enableConsole) return;

    console.log();
    console.table([headers, ...rows]);
    console.log();
  }

  /**
   * 核心日志方法
   */
  private log(level: LogLevel, message: string, context?: any): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context
    };

    this.logs.push(entry);

    if (this.enableConsole) {
      this.outputToConsole(entry);
    }
  }

  /**
   * 输出到控制台
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toTimeString().split(' ')[0];
    const formattedMessage = this.formatMessage(entry.level, entry.message);
    
    console.log(`${chalk.gray(`[${timestamp}]`)} ${formattedMessage}`);
    
    if (entry.context && entry.level === 'error') {
      console.log(chalk.gray('Context:'), entry.context);
    }
  }

  /**
   * 格式化消息
   */
  private formatMessage(level: LogLevel, message: string): string {
    switch (level) {
      case 'debug':
        return chalk.gray(`🔍 ${message}`);
      case 'info':
        return chalk.blue(`ℹ️  ${message}`);
      case 'warn':
        return chalk.yellow(`⚠️  ${message}`);
      case 'error':
        return chalk.red(`❌ ${message}`);
      default:
        return message;
    }
  }

  /**
   * 创建进度条
   */
  private createProgressBar(percentage: number, length: number = 20): string {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    const color = percentage === 100 ? chalk.green : 
                  percentage >= 70 ? chalk.blue : 
                  percentage >= 40 ? chalk.yellow : chalk.red;
    
    return color(`[${bar}] ${percentage}%`);
  }

  /**
   * 获取所有日志记录
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * 获取特定级别的日志
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * 清空日志
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * 导出日志到文件
   */
  exportLogs(): string {
    return this.logs.map(log => {
      const timestamp = log.timestamp.toISOString();
      const context = log.context ? ` | Context: ${JSON.stringify(log.context)}` : '';
      return `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}${context}`;
    }).join('\n');
  }

  /**
   * 输出统计信息
   */
  printStats(): void {
    const stats = {
      total: this.logs.length,
      debug: this.getLogsByLevel('debug').length,
      info: this.getLogsByLevel('info').length,
      warn: this.getLogsByLevel('warn').length,
      error: this.getLogsByLevel('error').length
    };

    this.separator('日志统计');
    this.info(`总日志数: ${stats.total}`);
    this.info(`调试: ${stats.debug} | 信息: ${stats.info} | 警告: ${stats.warn} | 错误: ${stats.error}`);
  }
}

/**
 * 全局日志实例
 */
export const logger = new Logger();

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
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
 * 格式化持续时间
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * 格式化数字
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('zh-CN').format(num);
} 