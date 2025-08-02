/**
 * 🚀 TypeScript类型同步生成工具
 * 复用价值: 90% (类型定义和接口复用)
 * 迁移目标: Supabase自动生成类型同步
 * 适配要求: Prisma Schema → Supabase TypeScript类型
 * 
 * @migration Supabase-First架构适配
 * @type_safety 自动生成Supabase类型定义
 * @performance 类型推导和代码提示优化
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface TypeDefinition {
  name: string;
  fields: FieldDefinition[];
  enums?: EnumDefinition[];
}

interface FieldDefinition {
  name: string;
  type: string;
  nullable: boolean;
  isArray?: boolean;
  reference?: string;
}

interface EnumDefinition {
  name: string;
  values: string[];
}

interface SupabaseTypeConfig {
  projectRef: string;
  apiKey?: string;
  outputPath: string;
}

export class TypeSyncGenerator {
  private readonly supabaseTypes: Record<string, string> = {
    'String': 'string',
    'Int': 'number',
    'Float': 'number', 
    'Decimal': 'number',
    'Boolean': 'boolean',
    'DateTime': 'string', // ISO string format
    'Json': 'Json',
    'Bytes': 'string' // base64 encoded
  };

  /**
   * 从Supabase生成TypeScript类型定义
   */
  async generateSupabaseTypes(config: SupabaseTypeConfig): Promise<string> {
    console.log('🔄 开始从Supabase生成TypeScript类型...');
    
    try {
      // 使用Supabase CLI生成类型
      const command = `supabase gen types typescript --project-id ${config.projectRef}`;
      console.log(`执行命令: ${command}`);
      
      const supabaseTypes = execSync(command, { encoding: 'utf-8' });
      
      // 生成增强的类型定义
      const enhancedTypes = this.enhanceSupabaseTypes(supabaseTypes);
      
      console.log('✅ Supabase类型生成完成');
      return enhancedTypes;
      
    } catch (error) {
      console.warn('⚠️ Supabase CLI不可用，使用本地类型生成');
      return this.generateLocalTypes();
    }
  }

  /**
   * 增强Supabase生成的类型
   */
  private enhanceSupabaseTypes(supabaseTypes: string): string {
    let enhanced = `// 🚨 自动生成的Supabase类型定义 - 增强版本
// 生成时间: ${new Date().toISOString()}
// 来源: Supabase CLI + 本地增强
// 特性: 包含业务逻辑类型和工具函数

`;
    
    // 添加原始Supabase类型
    enhanced += supabaseTypes;
    
    // 添加业务逻辑类型
    enhanced += this.generateBusinessTypes();
    
    // 添加工具类型
    enhanced += this.generateUtilityTypes();
    
    // 添加API客户端类型
    enhanced += this.generateApiClientTypes();
    
    return enhanced;
  }

  /**
   * 生成本地类型定义（fallback）
   */
  private generateLocalTypes(): string {
    return `// 🚨 本地类型定义 - Supabase兼容版本
// 生成时间: ${new Date().toISOString()}
// 注意: 这是fallback版本，建议使用Supabase CLI生成官方类型

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          phone: string | null;
          license_number: string | null;
          address: Json | null;
          preferences: Json | null;
          metadata: Json | null;
          specialization: string | null;
          clinic: string | null;
          qualifications: Json | null;
          apc_expiry_date: string | null;
          apc_file_url: string | null;
          apc_upload_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          phone?: string | null;
          license_number?: string | null;
          address?: Json | null;
          preferences?: Json | null;
          metadata?: Json | null;
          specialization?: string | null;
          clinic?: string | null;
          qualifications?: Json | null;
          apc_expiry_date?: string | null;
          apc_file_url?: string | null;
          apc_upload_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string;
          phone?: string | null;
          license_number?: string | null;
          address?: Json | null;
          preferences?: Json | null;
          metadata?: Json | null;
          specialization?: string | null;
          clinic?: string | null;
          qualifications?: Json | null;
          apc_expiry_date?: string | null;
          apc_file_url?: string | null;
          apc_upload_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      // 更多表定义...
    };
    Views: {
      // 视图定义
    };
    Functions: {
      // 函数定义
    };
    Enums: {
      user_role: "practitioner" | "patient" | "pharmacy_operator" | "admin";
      user_status: "pending" | "approved" | "suspended";
      order_status: "DRAFT" | "PAYMENT_FAILED" | "PAID" | "PENDING_REVIEW" | "REJECTED" | "FULFILLED" | "CANCELLED" | "EXPIRED" | "PROCESSING" | "READY_FOR_PICKUP" | "COMPLETED";
      payment_status: "pending" | "processing" | "completed" | "failed" | "refunded";
      // 更多枚举...
    };
    CompositeTypes: {
      // 复合类型定义
    };
  };
}

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

${this.generateBusinessTypes()}
${this.generateUtilityTypes()}
${this.generateApiClientTypes()}`;
  }

  /**
   * 生成业务逻辑类型
   */
  private generateBusinessTypes(): string {
    return `
// =========================================
// 业务逻辑类型定义
// =========================================

// 医师账户管理
export interface PractitionerAccount {
  id: string;
  practitioner_id: string;
  balance: number;
  credit_limit: number;
  used_credit: number;
  available_credit: number | null;
  status: 'active' | 'suspended' | 'frozen';
  version: number;
  created_at: string;
  updated_at: string;
}

// 处方信息
export interface Prescription {
  id: string;
  prescription_id: string;
  doctor_id: string;
  status: string;
  total_amount: number;
  notes: string | null;
  qr_code_data: string | null;
  version: number;
  copies: number;
  expires_at: string | null;
  payment_method: string | null;
  payment_status: string | null;
  created_at: string;
  updated_at: string;
}

// 药品信息
export interface Medicine {
  id: string;
  name: string;
  chinese_name: string | null;
  english_name: string | null;
  pinyin_name: string | null;
  sku: string;
  description: string | null;
  category: string | null;
  unit: string;
  requires_prescription: boolean;
  base_price: number;
  metadata: Json | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// 订单信息
export interface Order {
  id: string;
  platform_order_id: string;
  practitioner_id: string;
  patient_id: string | null;
  status: Database['public']['Enums']['order_status'];
  total_amount: number;
  payment_status: string | null;
  payment_method: string | null;
  assigned_pharmacy_id: string | null;
  dispensed_at: string | null;
  completed_at: string | null;
  qr_code_data: string | null;
  pdf_url: string | null;
  notes: string | null;
  version: number;
  idempotency_key: string | null;
  expires_at: string | null;
  copies: number;
  created_at: string;
  updated_at: string;
}

// API日志
export interface ApiCallLog {
  id: string;
  endpoint: string;
  method: string;
  status_code: number;
  user_id: string | null;
  user_agent: string | null;
  ip: string | null;
  duration: number;
  request_size: number | null;
  response_size: number | null;
  error_message: string | null;
  request_headers: Json | null;
  query_params: Json | null;
  request_body: Json | null;
  response_body: Json | null;
  metadata: Json | null;
  created_at: string;
}`;
  }

  /**
   * 生成工具类型
   */
  private generateUtilityTypes(): string {
    return `
// =========================================
// 工具类型和帮助函数
// =========================================

// 数据库表名类型
export type TableName = keyof Database['public']['Tables'];

// 行类型提取器
export type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];
export type Insert<T extends TableName> = Database['public']['Tables'][T]['Insert'];
export type Update<T extends TableName> = Database['public']['Tables'][T]['Update'];

// API响应类型
export interface ApiResponse<T> {
  data: T | null;
  error: {
    message: string;
    details?: string;
    hint?: string;
    code?: string;
  } | null;
  count?: number | null;
  status: number;
  statusText: string;
}

// 分页类型
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// 排序类型
export interface SortParams {
  column: string;
  ascending?: boolean;
}

// 过滤类型
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is' | 'cs' | 'cd';

export interface FilterParams {
  column: string;
  operator: FilterOperator;
  value: any;
}

// 查询构建器类型
export interface QueryParams {
  select?: string;
  filters?: FilterParams[];
  sort?: SortParams[];
  pagination?: PaginationParams;
}

// RLS上下文类型
export interface RLSContext {
  user_id: string;
  role: Database['public']['Enums']['user_role'];
  permissions?: string[];
}

// 审计日志类型
export interface AuditLog {
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  user_id: string;
  timestamp: string;
}`;
  }

  /**
   * 生成API客户端类型
   */
  private generateApiClientTypes(): string {
    return `
// =========================================
// API客户端类型定义
// =========================================

import { SupabaseClient } from '@supabase/supabase-js';

// Supabase客户端类型
export type SupabaseClientType = SupabaseClient<Database>;

// 认证相关类型
export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  role: Database['public']['Enums']['user_role'];
  user_metadata?: {
    full_name?: string;
    role?: string;
    [key: string]: any;
  };
  app_metadata?: {
    provider?: string;
    providers?: string[];
    [key: string]: any;
  };
}

// Edge Functions类型
export interface EdgeFunctionParams {
  [key: string]: any;
}

export interface EdgeFunctionResponse<T = any> {
  data?: T;
  error?: string;
}

// Realtime订阅类型
export interface RealtimeSubscription {
  table: TableName;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema?: string;
  filter?: string;
}

// 存储相关类型
export interface StorageFile {
  name: string;
  id?: string;
  updated_at?: string;
  created_at?: string;
  last_accessed_at?: string;
  metadata?: Record<string, any>;
}

export interface StorageUpload {
  file: File | Blob;
  path: string;
  options?: {
    cacheControl?: string;
    contentType?: string;
    upsert?: boolean;
  };
}

// 批量操作类型
export interface BatchOperation<T extends TableName> {
  table: T;
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  data: Insert<T>[] | Update<T>[] | { id: string }[];
}

// 错误处理类型
export interface DatabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

// 性能监控类型
export interface QueryMetrics {
  query: string;
  duration: number;
  table: string;
  operation: string;
  row_count?: number;
  execution_plan?: any;
}

// 类型守卫函数
export function isApiResponse<T>(obj: any): obj is ApiResponse<T> {
  return obj && typeof obj === 'object' && 'data' in obj && 'error' in obj;
}

export function isDatabaseError(obj: any): obj is DatabaseError {
  return obj && typeof obj === 'object' && 'message' in obj;
}

// 类型转换工具
export function toSupabaseRow<T extends TableName>(tableName: T, data: any): Row<T> {
  // 实现数据转换逻辑
  return data as Row<T>;
}

export function fromSupabaseRow<T extends TableName>(tableName: T, row: Row<T>): any {
  // 实现逆向转换逻辑
  return row;
}`;
  }

  /**
   * 同步类型到项目中
   */
  async syncTypesToProject(
    config: SupabaseTypeConfig,
    projectPaths: {
      types: string;
      utils: string;
      client: string;
    }
  ): Promise<void> {
    console.log('🔄 开始同步类型到项目...');
    
    try {
      // 生成类型定义
      const types = await this.generateSupabaseTypes(config);
      
      // 生成客户端配置
      const clientConfig = this.generateClientConfig(config);
      
      // 生成工具函数
      const utilityFunctions = this.generateUtilityFunctions();
      
      // 保存文件
      await fs.writeFile(projectPaths.types, types);
      await fs.writeFile(projectPaths.client, clientConfig);
      await fs.writeFile(projectPaths.utils, utilityFunctions);
      
      console.log('✅ 类型同步完成');
      console.log(`📁 类型文件: ${projectPaths.types}`);
      console.log(`📁 客户端配置: ${projectPaths.client}`);
      console.log(`📁 工具函数: ${projectPaths.utils}`);
      
    } catch (error) {
      console.error('❌ 类型同步失败:', error);
      throw error;
    }
  }

  /**
   * 生成客户端配置
   */
  private generateClientConfig(config: SupabaseTypeConfig): string {
    return `// 🚨 Supabase客户端配置 - 自动生成
// 生成时间: ${new Date().toISOString()}

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 创建Supabase客户端实例
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// 服务端客户端（仅在服务端使用）
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// 导出类型
export type { Database } from './types';
`;
  }

  /**
   * 生成工具函数
   */
  private generateUtilityFunctions(): string {
    return `// 🚨 Supabase工具函数 - 自动生成
// 生成时间: ${new Date().toISOString()}

import { supabase } from './client';
import type { Database, Row, Insert, Update, TableName, ApiResponse } from './types';

// 通用查询函数
export async function queryTable<T extends TableName>(
  table: T,
  options?: {
    select?: string;
    filters?: Array<{ column: string; operator: string; value: any }>;
    limit?: number;
    offset?: number;
    orderBy?: { column: string; ascending?: boolean }[];
  }
): Promise<ApiResponse<Row<T>[]>> {
  let query = supabase.from(table).select(options?.select || '*');
  
  // 应用过滤条件
  if (options?.filters) {
    options.filters.forEach(filter => {
      query = query.filter(filter.column, filter.operator, filter.value);
    });
  }
  
  // 应用排序
  if (options?.orderBy) {
    options.orderBy.forEach(order => {
      query = query.order(order.column, { ascending: order.ascending ?? true });
    });
  }
  
  // 应用分页
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, (options.offset + (options.limit || 10)) - 1);
  }
  
  const result = await query;
  
  return {
    data: result.data,
    error: result.error,
    count: result.count,
    status: result.status,
    statusText: result.statusText
  };
}

// 插入数据
export async function insertRow<T extends TableName>(
  table: T,
  data: Insert<T>
): Promise<ApiResponse<Row<T>>> {
  const result = await supabase.from(table).insert(data).select().single();
  
  return {
    data: result.data,
    error: result.error,
    status: result.status,
    statusText: result.statusText
  };
}

// 更新数据
export async function updateRow<T extends TableName>(
  table: T,
  id: string,
  data: Update<T>
): Promise<ApiResponse<Row<T>>> {
  const result = await supabase.from(table).update(data).eq('id', id).select().single();
  
  return {
    data: result.data,
    error: result.error,
    status: result.status,
    statusText: result.statusText
  };
}

// 删除数据
export async function deleteRow<T extends TableName>(
  table: T,
  id: string
): Promise<ApiResponse<null>> {
  const result = await supabase.from(table).delete().eq('id', id);
  
  return {
    data: null,
    error: result.error,
    status: result.status,
    statusText: result.statusText
  };
}

// RLS策略测试
export async function testRLSPolicy<T extends TableName>(
  table: T,
  userId: string
): Promise<{ canRead: boolean; canWrite: boolean; error?: string }> {
  try {
    // 测试读权限
    const readTest = await supabase.from(table).select('id').limit(1);
    const canRead = !readTest.error;
    
    // 测试写权限（尝试插入一个测试记录）
    const writeTest = await supabase.from(table).insert({} as any);
    const canWrite = !writeTest.error || writeTest.error.code !== '42501'; // 权限拒绝错误
    
    return { canRead, canWrite };
  } catch (error) {
    return {
      canRead: false,
      canWrite: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 批量操作
export async function batchOperations<T extends TableName>(
  operations: Array<{
    table: T;
    operation: 'insert' | 'update' | 'delete';
    data: any;
    condition?: Record<string, any>;
  }>
): Promise<ApiResponse<any[]>> {
  const results = [];
  
  for (const op of operations) {
    let result;
    
    switch (op.operation) {
      case 'insert':
        result = await supabase.from(op.table).insert(op.data);
        break;
      case 'update':
        let updateQuery = supabase.from(op.table).update(op.data);
        if (op.condition) {
          Object.entries(op.condition).forEach(([key, value]) => {
            updateQuery = updateQuery.eq(key, value);
          });
        }
        result = await updateQuery;
        break;
      case 'delete':
        let deleteQuery = supabase.from(op.table).delete();
        if (op.condition) {
          Object.entries(op.condition).forEach(([key, value]) => {
            deleteQuery = deleteQuery.eq(key, value);
          });
        }
        result = await deleteQuery;
        break;
    }
    
    results.push(result);
  }
  
  const hasError = results.some(r => r.error);
  
  return {
    data: results.map(r => r.data),
    error: hasError ? { message: 'One or more operations failed' } : null,
    status: hasError ? 400 : 200,
    statusText: hasError ? 'Bad Request' : 'OK'
  };
}
`;
  }

  /**
   * 生成类型检查脚本
   */
  async generateTypeCheckScript(outputPath: string): Promise<void> {
    const script = `#!/usr/bin/env node
// 🚨 Supabase类型检查脚本 - 自动生成
// 生成时间: ${new Date().toISOString()}

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const TYPES_PATH = path.join(__dirname, '../types/supabase.ts');

if (!PROJECT_REF) {
  console.error('❌ SUPABASE_PROJECT_REF环境变量未设置');
  process.exit(1);
}

try {
  console.log('🔄 正在从Supabase生成最新类型...');
  
  // 生成最新类型
  const newTypes = execSync(
    \`supabase gen types typescript --project-id \${PROJECT_REF}\`,
    { encoding: 'utf-8' }
  );
  
  // 检查是否有变化
  if (fs.existsSync(TYPES_PATH)) {
    const currentTypes = fs.readFileSync(TYPES_PATH, 'utf-8');
    
    if (currentTypes.includes(newTypes.trim())) {
      console.log('✅ 类型定义无变化');
      process.exit(0);
    }
  }
  
  // 保存新类型
  const enhancedTypes = \`// 🚨 自动生成的Supabase类型定义
// 生成时间: \${new Date().toISOString()}
// 项目: \${PROJECT_REF}

\${newTypes}\`;
  
  fs.writeFileSync(TYPES_PATH, enhancedTypes);
  console.log('✅ 类型定义已更新');
  console.log(\`📁 保存到: \${TYPES_PATH}\`);
  
  // 运行TypeScript类型检查
  console.log('🔍 运行TypeScript类型检查...');
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('✅ 类型检查通过');
  
} catch (error) {
  console.error('❌ 类型更新或检查失败:', error.message);
  process.exit(1);
}
`;
    
    await fs.writeFile(outputPath, script);
    
    // 设置执行权限
    try {
      execSync(`chmod +x ${outputPath}`);
    } catch (error) {
      console.warn('⚠️ 无法设置脚本执行权限');
    }
    
    console.log(`✅ 类型检查脚本已生成: ${outputPath}`);
  }
}

// CLI接口
export async function generateTypeSync(config: SupabaseTypeConfig, outputDir: string): Promise<void> {
  const generator = new TypeSyncGenerator();
  
  try {
    console.log('🚀 开始TypeScript类型同步生成...');
    console.log(`📁 输出目录: ${outputDir}`);
    console.log(`🔑 项目ID: ${config.projectRef}`);
    
    // 生成项目路径
    const projectPaths = {
      types: join(outputDir, 'supabase-types.ts'),
      client: join(outputDir, 'supabase-client.ts'), 
      utils: join(outputDir, 'supabase-utils.ts')
    };
    
    // 同步类型到项目
    await generator.syncTypesToProject(config, projectPaths);
    
    // 生成类型检查脚本
    const scriptPath = join(outputDir, 'update-types.js');
    await generator.generateTypeCheckScript(scriptPath);
    
    console.log('🎉 TypeScript类型同步生成完成！');
    console.log('\n下一步操作：');
    console.log('1. 设置环境变量: SUPABASE_PROJECT_REF');
    console.log('2. 运行类型更新: node update-types.js');
    console.log('3. 在项目中导入: import { supabase } from \'./supabase-client\''); 
    console.log('4. 设置CI/CD自动类型检查');
    
  } catch (error) {
    console.error('❌ TypeScript类型同步生成失败:', error);
    throw error;
  }
}