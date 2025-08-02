/**
 * 🔧 Supabase Schema生成工具
 * 复用价值: 80% (Prisma迁移逻辑复用)
 * 迁移目标: Supabase Migration Scripts
 * 适配要求: Prisma → Supabase SQL转换
 * 
 * @migration Supabase-First架构适配
 * @security RLS策略集成要求
 * @performance Edge Functions优化建议
 */

import { promises as fs } from 'fs';
import { join } from 'path';

interface MigrationFiles {
  sql: string;
  rlsPolicies: string;
  seedData: string;
}

interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  indexes: IndexDefinition[];
  constraints: ConstraintDefinition[];
}

interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  unique?: boolean;
}

interface IndexDefinition {
  name: string;
  columns: string[];
  unique?: boolean;
}

interface ConstraintDefinition {
  name: string;
  type: 'foreign_key' | 'check' | 'unique';
  definition: string;
}

export class SupabaseSchemaGenerator {
  private readonly prismaTypeMappings: Record<string, string> = {
    'String': 'TEXT',
    'Int': 'INTEGER',
    'Float': 'REAL',
    'Decimal': 'DECIMAL',
    'Boolean': 'BOOLEAN',
    'DateTime': 'TIMESTAMPTZ(6)',
    'Json': 'JSONB',
    'Bytes': 'BYTEA'
  };

  /**
   * 从Prisma Schema生成Supabase迁移文件
   */
  async generateFromPrisma(prismaPath: string): Promise<MigrationFiles> {
    console.log('🔄 开始Prisma Schema转换...');
    
    const prismaContent = await fs.readFile(prismaPath, 'utf-8');
    const tables = this.parsePrismaSchema(prismaContent);
    
    const sql = this.generateMigrationSQL(tables);
    const rlsPolicies = this.generateRLSPolicies(tables);
    const seedData = await this.generateSeedData();
    
    console.log('✅ Prisma Schema转换完成');
    
    return {
      sql,
      rlsPolicies,
      seedData
    };
  }

  /**
   * 解析Prisma Schema文件
   */
  private parsePrismaSchema(content: string): TableDefinition[] {
    const tables: TableDefinition[] = [];
    const modelRegex = /model\s+(\w+)\s*{([^}]+)}/gs;
    
    let match;
    while ((match = modelRegex.exec(content)) !== null) {
      const [, modelName, modelBody] = match;
      const table = this.parseModel(modelName, modelBody);
      tables.push(table);
    }
    
    return tables;
  }

  /**
   * 解析单个Prisma Model
   */
  private parseModel(name: string, body: string): TableDefinition {
    const columns: ColumnDefinition[] = [];
    const indexes: IndexDefinition[] = [];
    const constraints: ConstraintDefinition[] = [];
    
    // 解析字段定义
    const fieldRegex = /^\s*(\w+)\s+([^\s@]+)(\??)\s*(@.*)?$/gm;
    
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
      const [, fieldName, fieldType, optional, attributes] = fieldMatch;
      
      if (this.isRelationField(fieldType)) {
        continue; // 跳过关系字段
      }
      
      const column: ColumnDefinition = {
        name: this.toSnakeCase(fieldName),
        type: this.mapPrismaType(fieldType),
        nullable: optional === '?',
        defaultValue: this.extractDefaultValue(attributes),
        unique: this.hasAttribute(attributes, '@unique')
      };
      
      columns.push(column);
    }
    
    // 解析索引
    const indexRegex = /@@index\(\[([^\]]+)\]/g;
    let indexMatch;
    while ((indexMatch = indexRegex.exec(body)) !== null) {
      const [, columnList] = indexMatch;
      const columns = columnList.split(',').map(col => 
        this.toSnakeCase(col.trim().replace(/['"]/g, ''))
      );
      
      indexes.push({
        name: `idx_${this.toSnakeCase(name)}_${columns.join('_')}`,
        columns
      });
    }
    
    return {
      name: this.toSnakeCase(name),
      columns,
      indexes,
      constraints
    };
  }

  /**
   * 生成完整的迁移SQL
   */
  private generateMigrationSQL(tables: TableDefinition[]): string {
    let sql = `-- 🚨 Supabase Migration SQL - 自动生成
-- 生成时间: ${new Date().toISOString()}
-- 源文件: Prisma Schema
-- 目标: Supabase PostgreSQL + RLS策略

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

`;

    // 生成表结构
    for (const table of tables) {
      sql += this.generateTableSQL(table);
      sql += '\n';
    }

    // 生成索引
    for (const table of tables) {
      if (table.indexes.length > 0) {
        sql += `-- ${table.name}表索引\n`;
        for (const index of table.indexes) {
          sql += `CREATE INDEX ${index.name} ON ${table.name}(${index.columns.join(', ')});\n`;
        }
        sql += '\n';
      }
    }

    // 生成触发器
    sql += this.generateTriggers(tables);

    return sql;
  }

  /**
   * 生成单个表的SQL
   */
  private generateTableSQL(table: TableDefinition): string {
    let sql = `CREATE TABLE ${table.name} (\n`;
    
    const columnSql = table.columns.map(col => {
      let columnDef = `    ${col.name} ${col.type}`;
      
      if (col.name === 'id') {
        columnDef += ' PRIMARY KEY DEFAULT gen_random_uuid()';
      } else if (!col.nullable) {
        columnDef += ' NOT NULL';
      }
      
      if (col.defaultValue) {
        columnDef += ` DEFAULT ${col.defaultValue}`;
      }
      
      if (col.unique) {
        columnDef += ' UNIQUE';
      }
      
      return columnDef;
    });
    
    sql += columnSql.join(',\n');
    sql += '\n);\n\n';
    
    return sql;
  }

  /**
   * 生成RLS策略
   */
  private generateRLSPolicies(tables: TableDefinition[]): string {
    let policies = `-- 🚨 Supabase RLS策略 - 自动生成
-- 生成时间: ${new Date().toISOString()}
-- 目标: 数据库层权限控制

-- 启用所有表的RLS
`;

    for (const table of tables) {
      policies += `ALTER TABLE ${table.name} ENABLE ROW LEVEL SECURITY;\n`;
    }

    policies += '\n';

    // 生成基础权限策略
    for (const table of tables) {
      policies += this.generateTableRLSPolicies(table);
    }

    return policies;
  }

  /**
   * 生成单个表的RLS策略
   */
  private generateTableRLSPolicies(table: TableDefinition): string {
    let policies = `-- ${table.name}表权限策略\n`;
    
    if (table.name.includes('practitioner') || table.name.includes('prescription')) {
      // 医师相关表策略
      policies += `CREATE POLICY "practitioners_own_${table.name}" ON ${table.name}
    FOR ALL USING (
        auth.uid()::text = practitioner_id::text
        OR auth.uid()::text = doctor_id::text
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

`;
    } else if (table.name.includes('pharmacy')) {
      // 药房相关表策略
      policies += `CREATE POLICY "pharmacy_operators_own_${table.name}" ON ${table.name}
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM pharmacies 
            WHERE id = pharmacy_id 
            AND operator_id = auth.uid()
        )
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

`;
    } else if (table.name === 'medicines') {
      // 药品表公共读取策略
      policies += `CREATE POLICY "authenticated_users_read_${table.name}" ON ${table.name}
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "admin_manage_${table.name}" ON ${table.name}
    FOR ALL USING ((auth.jwt() ->> 'role')::text = 'admin');

`;
    } else {
      // 默认策略
      policies += `CREATE POLICY "users_access_own_${table.name}" ON ${table.name}
    FOR ALL USING (
        auth.uid()::text = user_id::text
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

`;
    }
    
    return policies;
  }

  /**
   * 生成触发器
   */
  private generateTriggers(tables: TableDefinition[]): string {
    let triggers = `-- 自动更新触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

`;

    for (const table of tables) {
      if (table.columns.some(col => col.name === 'updated_at')) {
        triggers += `CREATE TRIGGER update_${table.name}_updated_at 
    BEFORE UPDATE ON ${table.name} 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();\n`;
      }
    }

    return triggers;
  }

  /**
   * 生成种子数据
   */
  private async generateSeedData(): Promise<string> {
    return `-- 🚨 Supabase种子数据 - 隐私合规版本
-- 生成时间: ${new Date().toISOString()}
-- 特征: 完全匿名化，无患者隐私信息

-- 插入测试用户（使用Supabase Auth）
-- 注意：实际用户数据应通过Supabase Auth API创建

-- 插入药品数据（从medicines-seed-441.csv生成）
-- 这部分数据将从CSV文件动态生成
`;
  }

  /**
   * 工具函数：转换为snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
  }

  /**
   * 工具函数：映射Prisma类型到PostgreSQL类型
   */
  private mapPrismaType(prismaType: string): string {
    // 处理数组类型
    if (prismaType.endsWith('[]')) {
      const baseType = prismaType.slice(0, -2);
      return `${this.mapPrismaType(baseType)}[]`;
    }

    // 处理复杂类型
    if (prismaType.startsWith('Decimal')) {
      const match = prismaType.match(/Decimal\((\d+),\s*(\d+)\)/);
      if (match) {
        return `DECIMAL(${match[1]}, ${match[2]})`;
      }
      return 'DECIMAL';
    }

    if (prismaType.includes('@db.')) {
      const dbType = prismaType.split('@db.')[1];
      return dbType.replace(/\([^)]*\)/, match => match.toLowerCase());
    }

    return this.prismaTypeMappings[prismaType] || 'TEXT';
  }

  /**
   * 工具函数：检查是否为关系字段
   */
  private isRelationField(type: string): boolean {
    return /^[A-Z]/.test(type) && !['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Decimal', 'Bytes'].includes(type);
  }

  /**
   * 工具函数：提取默认值
   */
  private extractDefaultValue(attributes?: string): string | undefined {
    if (!attributes) return undefined;
    
    const defaultMatch = attributes.match(/@default\(([^)]+)\)/);
    if (!defaultMatch) return undefined;
    
    const value = defaultMatch[1];
    
    // 处理特殊默认值
    if (value === 'now()') return 'NOW()';
    if (value === 'cuid()') return 'gen_random_uuid()';
    if (value === 'uuid()') return 'gen_random_uuid()';
    if (value === 'autoincrement()') return undefined; // 使用SERIAL
    
    // 处理字符串值
    if (value.startsWith('"') && value.endsWith('"')) {
      return `'${value.slice(1, -1)}'`;
    }
    
    return value;
  }

  /**
   * 工具函数：检查是否有特定属性
   */
  private hasAttribute(attributes?: string, attr?: string): boolean {
    if (!attributes || !attr) return false;
    return attributes.includes(attr);
  }

  /**
   * 保存生成的文件
   */
  async saveFiles(migrationFiles: MigrationFiles, outputDir: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    await fs.writeFile(
      join(outputDir, `${timestamp}_supabase_migration.sql`),
      migrationFiles.sql
    );
    
    await fs.writeFile(
      join(outputDir, `${timestamp}_rls_policies.sql`),
      migrationFiles.rlsPolicies
    );
    
    await fs.writeFile(
      join(outputDir, `${timestamp}_seed_data.sql`),
      migrationFiles.seedData
    );
    
    console.log(`✅ 迁移文件已保存到: ${outputDir}`);
  }
}

// CLI接口
export async function generateSupabaseSchema(prismaPath: string, outputDir: string): Promise<void> {
  const generator = new SupabaseSchemaGenerator();
  
  try {
    console.log('🚀 开始Supabase Schema生成...');
    console.log(`📁 Prisma Schema: ${prismaPath}`);
    console.log(`📁 输出目录: ${outputDir}`);
    
    const migrationFiles = await generator.generateFromPrisma(prismaPath);
    await generator.saveFiles(migrationFiles, outputDir);
    
    console.log('🎉 Supabase Schema生成完成！');
    console.log('\n下一步操作：');
    console.log('1. 检查生成的SQL文件');
    console.log('2. 执行数据库迁移: supabase db push');
    console.log('3. 启用RLS策略');
    console.log('4. 生成TypeScript类型: supabase gen types typescript');
    
  } catch (error) {
    console.error('❌ Schema生成失败:', error);
    throw error;
  }
}