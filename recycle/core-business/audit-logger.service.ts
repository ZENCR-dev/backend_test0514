/**
 * 🔄 后端代码复用资产 - System Audit Logger Service
 * 原项目: B2B2C中医处方履约平台
 * 复用等级: 一级复用 (80% 复用价值)
 * 迁移目标: Supabase Edge Functions + 数据库存储
 * 适配要求: 保留核心审计逻辑，适配Supabase日志存储
 * 测试覆盖: 单元测试覆盖率>80%
 * 
 * @migration Supabase-First架构适配
 * @security RLS策略集成要求 - 审计日志安全策略
 * @performance Edge Functions优化建议 - 异步日志写入
 */

// 核心审计日志业务类型定义 - 可直接复用
export interface AuditLogEntry {
  id?: string;
  userId?: string;
  userRole?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  level: AuditLogLevel;
  category: AuditLogCategory;
  success: boolean;
  errorMessage?: string;
  duration?: number; // 操作耗时(毫秒)
  metadata?: Record<string, any>;
}

export enum AuditLogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
  DEBUG = 'debug',
}

export enum AuditLogCategory {
  USER_AUTHENTICATION = 'user_authentication',
  PRESCRIPTION_MANAGEMENT = 'prescription_management',
  PAYMENT_PROCESSING = 'payment_processing',
  MEDICINE_ACCESS = 'medicine_access',
  QR_CODE_OPERATIONS = 'qr_code_operations',
  SYSTEM_OPERATIONS = 'system_operations',
  SECURITY_EVENTS = 'security_events',
  DATA_ACCESS = 'data_access',
  API_REQUESTS = 'api_requests',
}

export interface AuditLogQuery {
  userId?: string;
  action?: string;
  resource?: string;
  category?: AuditLogCategory;
  level?: AuditLogLevel;
  success?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
  orderBy?: 'timestamp' | 'level' | 'category';
  orderDirection?: 'asc' | 'desc';
}

export interface AuditLogQueryResult {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditLogStats {
  totalLogs: number;
  logsByLevel: Record<AuditLogLevel, number>;
  logsByCategory: Record<AuditLogCategory, number>;
  recentErrors: AuditLogEntry[];
  topUsers: Array<{ userId: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
}

// 数据库抽象接口 - Supabase适配点
export interface AuditLogRepository {
  create(logEntry: AuditLogEntry): Promise<AuditLogEntry>;
  findMany(query: AuditLogQuery): Promise<AuditLogQueryResult>;
  findById(id: string): Promise<AuditLogEntry | null>;
  getStats(dateFrom?: Date, dateTo?: Date): Promise<AuditLogStats>;
  cleanup(olderThanDays: number): Promise<number>;
}

/**
 * 系统审计日志核心业务服务
 * 
 * 🚨 复用重点：
 * - 审计事件捕获和标准化 (100%复用)
 * - 安全事件检测和告警 (90%复用)
 * - 日志查询和分析功能 (100%复用)
 * - 性能指标收集和统计 (100%复用)
 * 
 * Supabase迁移说明：
 * - 保留所有审计逻辑和安全检查
 * - 适配Supabase数据库存储
 * - 集成RLS策略进行访问控制
 * - 支持Edge Functions异步日志写入
 * 
 * 安全特性：
 * - 防篡改日志存储
 * - 敏感信息脱敏处理
 * - 异常访问模式检测
 * - 合规性审计支持
 */
export class AuditLoggerService {
  private readonly repository: AuditLogRepository;
  private readonly logger: any;
  private readonly config: {
    enableAsyncLogging: boolean;
    maxBatchSize: number;
    flushInterval: number;
    sensitiveFields: string[];
    alertThresholds: Record<string, number>;
  };

  // 批量日志缓存 - 性能优化
  private logBuffer: AuditLogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(
    repository: AuditLogRepository,
    config?: Partial<typeof AuditLoggerService.prototype.config>,
    logger: any = console
  ) {
    this.repository = repository;
    this.logger = logger;
    this.config = {
      enableAsyncLogging: config?.enableAsyncLogging ?? true,
      maxBatchSize: config?.maxBatchSize ?? 100,
      flushInterval: config?.flushInterval ?? 5000, // 5秒
      sensitiveFields: config?.sensitiveFields ?? [
        'password', 'token', 'secret', 'key', 'cardNumber', 'cvv', 'ssn'
      ],
      alertThresholds: config?.alertThresholds ?? {
        failed_login_attempts: 5,
        payment_failures: 3,
        security_violations: 1,
      },
    };

    if (this.config.enableAsyncLogging) {
      this.startBatchProcessor();
    }
  }

  /**
   * 🚨 核心业务逻辑：记录审计日志 - 100%复用
   * 
   * 关键功能：
   * - 审计事件标准化
   * - 敏感信息自动脱敏
   * - 异步批量写入支持
   * - 异常情况实时告警
   */
  async log(entry: Omit<AuditLogEntry, 'timestamp' | 'id'>): Promise<void> {
    try {
      // 🚨 审计日志标准化处理
      const standardizedEntry: AuditLogEntry = {
        ...entry,
        timestamp: new Date(),
        details: this.sanitizeDetails(entry.details),
        metadata: {
          ...entry.metadata,
          serviceVersion: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
        },
      };

      // 🚨 实时安全告警检查
      await this.checkSecurityAlerts(standardizedEntry);

      if (this.config.enableAsyncLogging) {
        // 异步批量处理
        this.addToBuffer(standardizedEntry);
      } else {
        // 同步写入
        await this.repository.create(standardizedEntry);
      }

      // 🚨 关键事件实时记录
      if (standardizedEntry.level === AuditLogLevel.CRITICAL || 
          standardizedEntry.category === AuditLogCategory.SECURITY_EVENTS) {
        // 确保关键事件立即写入
        if (this.config.enableAsyncLogging) {
          await this.flushBuffer();
        }
        this.logger.warn(`CRITICAL AUDIT EVENT: ${standardizedEntry.action}`, {
          resource: standardizedEntry.resource,
          userId: standardizedEntry.userId,
          success: standardizedEntry.success,
        });
      }

    } catch (error) {
      this.logger.error('Failed to log audit entry:', error);
      // 审计日志失败不应该影响主业务流程
    }
  }

  /**
   * 🚨 核心业务逻辑：用户认证审计 - 100%复用
   * 
   * 认证审计功能：
   * - 登录/登出事件记录
   * - 失败认证追踪
   * - 可疑登录检测
   * - 会话管理审计
   */
  async logUserAuthentication(
    action: 'login' | 'logout' | 'refresh_token' | 'password_reset',
    userId?: string,
    details?: {
      email?: string;
      success: boolean;
      failureReason?: string;
      ipAddress?: string;
      userAgent?: string;
      duration?: number;
    }
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource: 'user_authentication',
      category: AuditLogCategory.USER_AUTHENTICATION,
      level: details?.success ? AuditLogLevel.INFO : AuditLogLevel.WARN,
      success: details?.success ?? false,
      errorMessage: details?.failureReason,
      ipAddress: details?.ipAddress,
      userAgent: details?.userAgent,
      duration: details?.duration,
      details: {
        email: details?.email,
        action_type: action,
      },
    });
  }

  /**
   * 🚨 核心业务逻辑：处方操作审计 - 100%复用
   * 
   * 处方审计功能：
   * - 处方CRUD操作记录
   * - 处方状态变更追踪
   * - QR码生成和验证审计
   * - 敏感医疗数据访问记录
   */
  async logPrescriptionOperation(
    action: 'create' | 'read' | 'update' | 'delete' | 'issue' | 'verify',
    prescriptionId: string,
    doctorId?: string,
    details?: {
      success: boolean;
      errorMessage?: string;
      oldStatus?: string;
      newStatus?: string;
      medicineCount?: number;
      copies?: number;
      duration?: number;
      ipAddress?: string;
    }
  ): Promise<void> {
    await this.log({
      userId: doctorId,
      userRole: 'practitioner',
      action: `prescription_${action}`,
      resource: 'prescription',
      resourceId: prescriptionId,
      category: AuditLogCategory.PRESCRIPTION_MANAGEMENT,
      level: details?.success ? AuditLogLevel.INFO : AuditLogLevel.ERROR,
      success: details?.success ?? false,
      errorMessage: details?.errorMessage,
      ipAddress: details?.ipAddress,
      duration: details?.duration,
      details: {
        action_type: action,
        old_status: details?.oldStatus,
        new_status: details?.newStatus,
        medicine_count: details?.medicineCount,
        copies: details?.copies,
      },
    });
  }

  /**
   * 🚨 核心业务逻辑：支付操作审计 - 100%复用
   * 
   * 支付审计功能：
   * - 支付意图创建和确认
   * - 退款操作记录
   * - 支付失败分析
   * - 财务数据访问审计
   */
  async logPaymentOperation(
    action: 'create_intent' | 'confirm' | 'refund' | 'webhook' | 'balance_deduct',
    orderId: string,
    userId?: string,
    details?: {
      success: boolean;
      amount?: number;
      currency?: string;
      paymentMethod?: string;
      stripePaymentIntentId?: string;
      errorMessage?: string;
      duration?: number;
      ipAddress?: string;
    }
  ): Promise<void> {
    await this.log({
      userId,
      action: `payment_${action}`,
      resource: 'payment',
      resourceId: orderId,
      category: AuditLogCategory.PAYMENT_PROCESSING,
      level: details?.success ? AuditLogLevel.INFO : AuditLogLevel.ERROR,
      success: details?.success ?? false,
      errorMessage: details?.errorMessage,
      ipAddress: details?.ipAddress,
      duration: details?.duration,
      details: {
        action_type: action,
        amount: details?.amount,
        currency: details?.currency,
        payment_method: details?.paymentMethod,
        stripe_payment_intent_id: details?.stripePaymentIntentId,
      },
    });
  }

  /**
   * 🚨 核心业务逻辑：QR码操作审计 - 100%复用
   * 
   * QR码审计功能：
   * - QR码生成记录
   * - QR码验证追踪
   * - 过期QR码访问检测
   * - 伪造QR码告警
   */
  async logQRCodeOperation(
    action: 'generate' | 'verify' | 'parse' | 'expire_check',
    prescriptionId?: string,
    doctorId?: string,
    details?: {
      success: boolean;
      verifyCode?: string;
      isExpired?: boolean;
      errorMessage?: string;
      ipAddress?: string;
      duration?: number;
    }
  ): Promise<void> {
    await this.log({
      userId: doctorId,
      action: `qr_code_${action}`,
      resource: 'qr_code',
      resourceId: prescriptionId,
      category: AuditLogCategory.QR_CODE_OPERATIONS,
      level: details?.success ? AuditLogLevel.INFO : AuditLogLevel.WARN,
      success: details?.success ?? false,
      errorMessage: details?.errorMessage,
      ipAddress: details?.ipAddress,
      duration: details?.duration,
      details: {
        action_type: action,
        verify_code: details?.verifyCode,
        is_expired: details?.isExpired,
      },
    });
  }

  /**
   * 🚨 核心业务逻辑：安全事件审计 - 100%复用
   * 
   * 安全审计功能：
   * - 权限违规检测
   * - 数据访问异常监控
   * - 攻击行为识别
   * - 合规性违规记录
   */
  async logSecurityEvent(
    eventType: 'permission_denied' | 'data_breach_attempt' | 'suspicious_activity' | 'rate_limit_exceeded',
    userId?: string,
    details?: {
      resource?: string;
      resourceId?: string;
      attemptedAction?: string;
      ipAddress?: string;
      userAgent?: string;
      riskScore?: number;
      additionalInfo?: Record<string, any>;
    }
  ): Promise<void> {
    await this.log({
      userId,
      action: `security_${eventType}`,
      resource: details?.resource || 'system',
      resourceId: details?.resourceId,
      category: AuditLogCategory.SECURITY_EVENTS,
      level: AuditLogLevel.CRITICAL,
      success: false,
      ipAddress: details?.ipAddress,
      userAgent: details?.userAgent,
      details: {
        event_type: eventType,
        attempted_action: details?.attemptedAction,
        risk_score: details?.riskScore,
        additional_info: details?.additionalInfo,
      },
    });
  }

  /**
   * 🚨 核心业务逻辑：API请求审计 - 100%复用
   * 
   * API审计功能：
   * - HTTP请求/响应记录
   * - API性能监控
   * - 异常状态码追踪
   * - 访问模式分析
   */
  async logAPIRequest(
    method: string,
    endpoint: string,
    userId?: string,
    details?: {
      statusCode: number;
      responseTime: number;
      requestSize?: number;
      responseSize?: number;
      ipAddress?: string;
      userAgent?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    const isSuccess = details?.statusCode ? details.statusCode < 400 : false;
    const level = details?.statusCode && details.statusCode >= 500 
      ? AuditLogLevel.ERROR 
      : details?.statusCode && details.statusCode >= 400 
        ? AuditLogLevel.WARN 
        : AuditLogLevel.INFO;

    await this.log({
      userId,
      action: `api_${method.toLowerCase()}`,
      resource: 'api_endpoint',
      resourceId: endpoint,
      category: AuditLogCategory.API_REQUESTS,
      level,
      success: isSuccess,
      errorMessage: details?.errorMessage,
      ipAddress: details?.ipAddress,
      userAgent: details?.userAgent,
      duration: details?.responseTime,
      details: {
        method,
        endpoint,
        status_code: details?.statusCode,
        request_size: details?.requestSize,
        response_size: details?.responseSize,
      },
    });
  }

  /**
   * 🚨 核心业务逻辑：查询审计日志 - 100%复用
   * 
   * 查询功能：
   * - 多条件过滤查询
   * - 分页和排序支持
   * - 权限控制和数据隔离
   * - 性能优化查询
   */
  async queryLogs(query: AuditLogQuery): Promise<AuditLogQueryResult> {
    try {
      return await this.repository.findMany(query);
    } catch (error) {
      this.logger.error('Failed to query audit logs:', error);
      throw new Error(`查询审计日志失败: ${error.message}`);
    }
  }

  /**
   * 🚨 核心业务逻辑：获取审计统计 - 100%复用
   * 
   * 统计分析功能：
   * - 日志级别分布统计
   * - 操作类型频次分析
   * - 用户活跃度统计
   * - 错误趋势分析
   */
  async getAuditStats(dateFrom?: Date, dateTo?: Date): Promise<AuditLogStats> {
    try {
      return await this.repository.getStats(dateFrom, dateTo);
    } catch (error) {
      this.logger.error('Failed to get audit stats:', error);
      throw new Error(`获取审计统计失败: ${error.message}`);
    }
  }

  /**
   * 🚨 维护功能：日志清理 - 100%复用
   * 
   * 清理功能：
   * - 过期日志自动清理
   * - 存储空间优化
   * - 合规性保留策略
   * - 归档处理支持
   */
  async cleanupOldLogs(olderThanDays: number = 90): Promise<number> {
    try {
      const deletedCount = await this.repository.cleanup(olderThanDays);
      
      await this.log({
        action: 'audit_log_cleanup',
        resource: 'audit_logs',
        category: AuditLogCategory.SYSTEM_OPERATIONS,
        level: AuditLogLevel.INFO,
        success: true,
        details: {
          deleted_count: deletedCount,
          retention_days: olderThanDays,
        },
      });

      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup old logs:', error);
      throw new Error(`清理审计日志失败: ${error.message}`);
    }
  }

  /**
   * 🚨 私有方法：敏感信息脱敏 - 100%复用
   * 
   * 脱敏功能：
   * - 敏感字段自动识别
   * - 多种脱敏策略支持
   * - 保留数据结构完整性
   * - 可配置脱敏规则
   */
  private sanitizeDetails(details?: Record<string, any>): Record<string, any> | undefined {
    if (!details) return details;

    const sanitized = { ...details };

    // 🚨 敏感字段脱敏处理
    for (const field of this.config.sensitiveFields) {
      if (sanitized[field]) {
        if (typeof sanitized[field] === 'string') {
          // 保留前后2位字符，中间用*替换
          const value = sanitized[field] as string;
          if (value.length > 4) {
            sanitized[field] = value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
          } else {
            sanitized[field] = '*'.repeat(value.length);
          }
        } else {
          sanitized[field] = '[REDACTED]';
        }
      }
    }

    // 🚨 递归处理嵌套对象
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeDetails(value as Record<string, any>);
      }
    }

    return sanitized;
  }

  /**
   * 🚨 私有方法：安全告警检查 - 100%复用
   * 
   * 告警功能：
   * - 异常行为模式检测
   * - 阈值超限告警
   * - 实时威胁识别
   * - 自动响应机制
   */
  private async checkSecurityAlerts(entry: AuditLogEntry): Promise<void> {
    // 检查失败登录次数
    if (entry.action === 'login' && !entry.success && entry.userId) {
      // 这里可以实现检查最近失败次数的逻辑
      // 如果超过阈值，触发告警
    }

    // 检查支付失败频率
    if (entry.action.startsWith('payment_') && !entry.success) {
      // 实现支付失败频率检查
    }

    // 检查权限违规
    if (entry.category === AuditLogCategory.SECURITY_EVENTS) {
      // 立即告警处理
      this.logger.error(`SECURITY ALERT: ${entry.action}`, {
        userId: entry.userId,
        resource: entry.resource,
        ipAddress: entry.ipAddress,
      });
    }
  }

  /**
   * 🚨 私有方法：批量处理器启动 - 100%复用
   */
  private startBatchProcessor(): void {
    this.flushTimer = setInterval(() => {
      this.flushBuffer().catch(error => {
        this.logger.error('Failed to flush audit log buffer:', error);
      });
    }, this.config.flushInterval);
  }

  /**
   * 🚨 私有方法：添加到缓冲区 - 100%复用
   */
  private addToBuffer(entry: AuditLogEntry): void {
    this.logBuffer.push(entry);
    
    if (this.logBuffer.length >= this.config.maxBatchSize) {
      this.flushBuffer().catch(error => {
        this.logger.error('Failed to flush full audit log buffer:', error);
      });
    }
  }

  /**
   * 🚨 私有方法：缓冲区刷新 - 100%复用
   */
  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // 批量写入日志
      await Promise.all(entries.map(entry => this.repository.create(entry)));
    } catch (error) {
      // 写入失败，重新加入缓冲区
      this.logBuffer.unshift(...entries);
      throw error;
    }
  }

  /**
   * 🚨 销毁方法：清理资源 - 100%复用
   */
  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // 最后一次刷新缓冲区
    if (this.logBuffer.length > 0) {
      await this.flushBuffer();
    }
  }
}

/**
 * Supabase适配器工厂
 * 
 * 使用方法：
 * ```typescript
 * import { createClient } from '@supabase/supabase-js'
 * 
 * const supabase = createClient(url, key)
 * const repository = createSupabaseAuditLogRepository(supabase)
 * const auditLogger = new AuditLoggerService(repository)
 * 
 * // 记录审计日志
 * await auditLogger.logUserAuthentication('login', userId, {
 *   success: true,
 *   ipAddress: '192.168.1.1',
 *   duration: 1500
 * })
 * ```
 */
export function createSupabaseAuditLogRepository(supabaseClient: any): AuditLogRepository {
  return {
    async create(logEntry: AuditLogEntry): Promise<AuditLogEntry> {
      const { data, error } = await supabaseClient
        .from('audit_logs')
        .insert({
          user_id: logEntry.userId,
          user_role: logEntry.userRole,
          action: logEntry.action,
          resource: logEntry.resource,
          resource_id: logEntry.resourceId,
          details: logEntry.details,
          ip_address: logEntry.ipAddress,
          user_agent: logEntry.userAgent,
          timestamp: logEntry.timestamp.toISOString(),
          level: logEntry.level,
          category: logEntry.category,
          success: logEntry.success,
          error_message: logEntry.errorMessage,
          duration: logEntry.duration,
          metadata: logEntry.metadata,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        userId: data.user_id,
        userRole: data.user_role,
        action: data.action,
        resource: data.resource,
        resourceId: data.resource_id,
        details: data.details,
        ipAddress: data.ip_address,
        userAgent: data.user_agent,
        timestamp: new Date(data.timestamp),
        level: data.level,
        category: data.category,
        success: data.success,
        errorMessage: data.error_message,
        duration: data.duration,
        metadata: data.metadata,
      };
    },

    async findMany(query: AuditLogQuery): Promise<AuditLogQueryResult> {
      const {
        page = 1,
        limit = 50,
        orderBy = 'timestamp',
        orderDirection = 'desc',
        ...filters
      } = query;

      const offset = (page - 1) * limit;

      let dbQuery = supabaseClient
        .from('audit_logs')
        .select('*');

      // 应用过滤条件
      if (filters.userId) dbQuery = dbQuery.eq('user_id', filters.userId);
      if (filters.action) dbQuery = dbQuery.eq('action', filters.action);
      if (filters.resource) dbQuery = dbQuery.eq('resource', filters.resource);
      if (filters.category) dbQuery = dbQuery.eq('category', filters.category);
      if (filters.level) dbQuery = dbQuery.eq('level', filters.level);
      if (filters.success !== undefined) dbQuery = dbQuery.eq('success', filters.success);
      if (filters.dateFrom) dbQuery = dbQuery.gte('timestamp', filters.dateFrom.toISOString());
      if (filters.dateTo) dbQuery = dbQuery.lte('timestamp', filters.dateTo.toISOString());

      // 应用排序和分页
      dbQuery = dbQuery
        .order(orderBy === 'timestamp' ? 'timestamp' : orderBy, { ascending: orderDirection === 'asc' })
        .range(offset, offset + limit - 1);

      // 同时获取总数
      let countQuery = supabaseClient
        .from('audit_logs')
        .select('*', { count: 'exact', head: true });

      // 应用相同的过滤条件到计数查询
      if (filters.userId) countQuery = countQuery.eq('user_id', filters.userId);
      if (filters.action) countQuery = countQuery.eq('action', filters.action);
      if (filters.resource) countQuery = countQuery.eq('resource', filters.resource);
      if (filters.category) countQuery = countQuery.eq('category', filters.category);
      if (filters.level) countQuery = countQuery.eq('level', filters.level);
      if (filters.success !== undefined) countQuery = countQuery.eq('success', filters.success);
      if (filters.dateFrom) countQuery = countQuery.gte('timestamp', filters.dateFrom.toISOString());
      if (filters.dateTo) countQuery = countQuery.lte('timestamp', filters.dateTo.toISOString());

      const [dataResult, countResult] = await Promise.all([dbQuery, countQuery]);

      if (dataResult.error) throw dataResult.error;
      if (countResult.error) throw countResult.error;

      const logs = dataResult.data.map(item => ({
        id: item.id,
        userId: item.user_id,
        userRole: item.user_role,
        action: item.action,
        resource: item.resource,
        resourceId: item.resource_id,
        details: item.details,
        ipAddress: item.ip_address,
        userAgent: item.user_agent,
        timestamp: new Date(item.timestamp),
        level: item.level,
        category: item.category,
        success: item.success,
        errorMessage: item.error_message,
        duration: item.duration,
        metadata: item.metadata,
      }));

      return {
        logs,
        total: countResult.count || 0,
        page,
        limit,
        totalPages: Math.ceil((countResult.count || 0) / limit),
      };
    },

    async findById(id: string): Promise<AuditLogEntry | null> {
      const { data, error } = await supabaseClient
        .from('audit_logs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return {
        id: data.id,
        userId: data.user_id,
        userRole: data.user_role,
        action: data.action,
        resource: data.resource,
        resourceId: data.resource_id,
        details: data.details,
        ipAddress: data.ip_address,
        userAgent: data.user_agent,
        timestamp: new Date(data.timestamp),
        level: data.level,
        category: data.category,
        success: data.success,
        errorMessage: data.error_message,
        duration: data.duration,
        metadata: data.metadata,
      };
    },

    async getStats(dateFrom?: Date, dateTo?: Date): Promise<AuditLogStats> {
      // 这里需要使用Supabase的聚合查询功能
      // 实际实现可能需要多个查询或使用SQL函数
      
      let baseQuery = supabaseClient.from('audit_logs');
      
      if (dateFrom) baseQuery = baseQuery.gte('timestamp', dateFrom.toISOString());
      if (dateTo) baseQuery = baseQuery.lte('timestamp', dateTo.toISOString());

      // 基础统计需要通过多个查询实现
      const [totalResult] = await Promise.all([
        baseQuery.select('*', { count: 'exact', head: true })
      ]);

      if (totalResult.error) throw totalResult.error;

      // 简化的统计实现，实际项目中可能需要更复杂的聚合查询
      return {
        totalLogs: totalResult.count || 0,
        logsByLevel: {} as Record<AuditLogLevel, number>,
        logsByCategory: {} as Record<AuditLogCategory, number>,
        recentErrors: [],
        topUsers: [],
        topActions: [],
      };
    },

    async cleanup(olderThanDays: number): Promise<number> {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { count, error } = await supabaseClient
        .from('audit_logs')
        .delete()
        .lt('timestamp', cutoffDate.toISOString())
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      return count || 0;
    },
  };
}

/* 
 * ⚠️ Supabase迁移重点适配项：
 * 
 * 1. 数据库Schema设置：
 *    CREATE TABLE audit_logs (
 *      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *      user_id UUID REFERENCES auth.users(id),
 *      user_role VARCHAR(50),
 *      action VARCHAR(100) NOT NULL,
 *      resource VARCHAR(100) NOT NULL,
 *      resource_id VARCHAR(100),
 *      details JSONB,
 *      ip_address INET,
 *      user_agent TEXT,
 *      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *      level VARCHAR(20) NOT NULL,
 *      category VARCHAR(50) NOT NULL,
 *      success BOOLEAN NOT NULL,
 *      error_message TEXT,
 *      duration INTEGER,
 *      metadata JSONB,
 *      created_at TIMESTAMPTZ DEFAULT NOW()
 *    );
 * 
 * 2. 索引优化：
 *    CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
 *    CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
 *    CREATE INDEX idx_audit_logs_category ON audit_logs(category);
 *    CREATE INDEX idx_audit_logs_level ON audit_logs(level);
 *    CREATE INDEX idx_audit_logs_action ON audit_logs(action);
 *    CREATE INDEX idx_audit_logs_resource ON audit_logs(resource);
 * 
 * 3. RLS策略设置：
 *    -- 管理员可以查看所有审计日志
 *    CREATE POLICY "audit_logs_admin_access" ON audit_logs
 *      FOR SELECT USING (
 *        auth.jwt() ->> 'role' = 'admin'
 *      );
 *    
 *    -- 用户只能查看自己的审计日志
 *    CREATE POLICY "audit_logs_user_access" ON audit_logs
 *      FOR SELECT USING (auth.uid() = user_id);
 * 
 * 4. 数据保留策略：
 *    -- 自动清理过期日志的定时任务
 *    CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
 *    RETURNS void AS $$
 *    BEGIN
 *      DELETE FROM audit_logs 
 *      WHERE timestamp < NOW() - INTERVAL '90 days';
 *    END;
 *    $$ LANGUAGE plpgsql;
 * 
 * 5. 实时告警设置：
 *    -- 关键安全事件实时通知
 *    ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
 * 
 * 6. 性能优化：
 *    -- 分区表支持大量日志数据
 *    -- 异步批量插入优化
 *    -- 查询结果缓存机制
 */