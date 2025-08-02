/**
 * 🔐 RLS策略生成工具
 * 复用价值: 85% (权限控制逻辑复用)
 * 迁移目标: 自动生成RLS策略
 * 适配要求: 基于表结构和业务规则生成权限策略
 * 
 * @migration Supabase-First架构适配
 * @security 数据库层权限控制
 * @performance 索引优化建议
 */

import { promises as fs } from 'fs';
import { join } from 'path';

interface TablePermission {
  tableName: string;
  userRoles: UserRolePermission[];
  specialRules?: SpecialRule[];
}

interface UserRolePermission {
  role: 'practitioner' | 'pharmacy_operator' | 'admin' | 'authenticated';
  permissions: PermissionType[];
  conditions?: string;
}

interface SpecialRule {
  name: string;
  description: string;
  policy: string;
}

type PermissionType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';

export class RLSPolicyGenerator {
  private readonly businessRules: Record<string, TablePermission> = {
    // 医师权限配置
    'user_profiles': {
      tableName: 'user_profiles',
      userRoles: [
        {
          role: 'practitioner',
          permissions: ['ALL'],
          conditions: 'auth.uid() = user_id'
        },
        {
          role: 'admin',
          permissions: ['ALL'],
          conditions: '(auth.jwt() ->> \'role\')::text = \'admin\''
        }
      ]
    },
    'practitioner_accounts': {
      tableName: 'practitioner_accounts',
      userRoles: [
        {
          role: 'practitioner',
          permissions: ['ALL'],
          conditions: 'auth.uid() = practitioner_id'
        },
        {
          role: 'admin',
          permissions: ['ALL'],
          conditions: '(auth.jwt() ->> \'role\')::text = \'admin\''
        }
      ]
    },
    'prescriptions': {
      tableName: 'prescriptions',
      userRoles: [
        {
          role: 'practitioner',
          permissions: ['ALL'],
          conditions: 'auth.uid() = doctor_id'
        },
        {
          role: 'admin',
          permissions: ['ALL'],
          conditions: '(auth.jwt() ->> \'role\')::text = \'admin\''
        }
      ],
      specialRules: [
        {
          name: 'only_practitioners_create_prescriptions',
          description: '确保处方只能由医师创建',
          policy: `CREATE POLICY "only_practitioners_create_prescriptions" ON prescriptions
    FOR INSERT WITH CHECK (
        (auth.jwt() ->> 'role')::text IN ('practitioner', 'admin')
        AND auth.uid() = doctor_id
    );`
        }
      ]
    },
    'pharmacies': {
      tableName: 'pharmacies',
      userRoles: [
        {
          role: 'pharmacy_operator',
          permissions: ['ALL'],
          conditions: 'auth.uid() = operator_id'
        },
        {
          role: 'admin',
          permissions: ['ALL'],
          conditions: '(auth.jwt() ->> \'role\')::text = \'admin\''
        }
      ]
    },
    'orders': {
      tableName: 'orders',
      userRoles: [
        {
          role: 'practitioner',
          permissions: ['ALL'],
          conditions: 'auth.uid() = practitioner_id'
        },
        {
          role: 'pharmacy_operator',
          permissions: ['SELECT', 'UPDATE'],
          conditions: `assigned_pharmacy_id IN (
            SELECT id FROM pharmacies 
            WHERE operator_id = auth.uid()
        )`
        },
        {
          role: 'admin',
          permissions: ['ALL'],
          conditions: '(auth.jwt() ->> \'role\')::text = \'admin\''
        }
      ]
    },
    'medicines': {
      tableName: 'medicines',
      userRoles: [
        {
          role: 'authenticated',
          permissions: ['SELECT'],
          conditions: 'auth.role() = \'authenticated\''
        },
        {
          role: 'admin',
          permissions: ['ALL'],
          conditions: '(auth.jwt() ->> \'role\')::text = \'admin\''
        }
      ]
    },
    'api_call_logs': {
      tableName: 'api_call_logs',
      userRoles: [
        {
          role: 'authenticated',
          permissions: ['SELECT'],
          conditions: 'auth.uid() = user_id'
        },
        {
          role: 'admin',
          permissions: ['ALL'],
          conditions: '(auth.jwt() ->> \'role\')::text = \'admin\''
        }
      ],
      specialRules: [
        {
          name: 'system_insert_api_logs',
          description: '系统可以插入API日志',
          policy: `CREATE POLICY "system_insert_api_logs" ON api_call_logs
    FOR INSERT WITH CHECK (true);`
        }
      ]
    }
  };

  /**
   * 生成完整的RLS策略SQL
   */
  async generateRLSPolicies(): Promise<string> {
    console.log('🔐 开始生成RLS策略...');
    
    let sql = `-- 🚨 自动生成的RLS策略 - Supabase权限控制
-- 生成时间: ${new Date().toISOString()}
-- 目标: 数据库层权限控制和数据隔离

-- =========================================
-- 1. 启用所有表的RLS
-- =========================================

`;

    // 启用RLS
    const tableNames = Object.keys(this.businessRules);
    for (const tableName of tableNames) {
      sql += `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;\n`;
    }
    
    sql += '\n-- =========================================\n';
    sql += '-- 2. 生成业务权限策略\n';
    sql += '-- =========================================\n\n';

    // 生成每个表的策略
    for (const [tableName, config] of Object.entries(this.businessRules)) {
      sql += `-- ${tableName}表权限策略\n`;
      sql += this.generateTablePolicies(config);
      sql += '\n';
    }

    // 生成安全审计策略
    sql += this.generateAuditPolicies();
    
    // 生成性能优化索引
    sql += this.generatePerformanceIndexes();
    
    // 生成权限授予语句
    sql += this.generatePermissionGrants();

    console.log('✅ RLS策略生成完成');
    return sql;
  }

  /**
   * 生成单个表的策略
   */
  private generateTablePolicies(config: TablePermission): string {
    let policies = '';
    
    // 生成基础权限策略
    for (const rolePermission of config.userRoles) {
      const { role, permissions, conditions } = rolePermission;
      
      for (const permission of permissions) {
        const policyName = `${role}_${permission.toLowerCase()}_${config.tableName}`;
        
        if (permission === 'ALL') {
          policies += `CREATE POLICY "${policyName}" ON ${config.tableName}
    FOR ALL USING (${conditions});

`;
        } else {
          policies += `CREATE POLICY "${policyName}" ON ${config.tableName}
    FOR ${permission} USING (${conditions});

`;
        }
      }
    }
    
    // 生成特殊业务规则
    if (config.specialRules) {
      for (const rule of config.specialRules) {
        policies += `-- ${rule.description}\n`;
        policies += rule.policy + '\n\n';
      }
    }
    
    return policies;
  }

  /**
   * 生成安全审计策略
   */
  private generateAuditPolicies(): string {
    return `-- =========================================
-- 3. 安全审计策略
-- =========================================

-- 创建审计触发器函数
CREATE OR REPLACE FUNCTION audit_user_actions()
RETURNS TRIGGER AS $$
BEGIN
    -- 记录重要操作到event_logs表
    IF TG_OP = 'DELETE' THEN
        INSERT INTO event_logs (event_type, payload, metadata)
        VALUES (
            TG_TABLE_NAME || '_DELETE',
            row_to_json(OLD),
            jsonb_build_object(
                'user_id', auth.uid(),
                'timestamp', NOW(),
                'table_name', TG_TABLE_NAME
            )
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO event_logs (event_type, payload, metadata)
        VALUES (
            TG_TABLE_NAME || '_UPDATE',
            jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW)),
            jsonb_build_object(
                'user_id', auth.uid(),
                'timestamp', NOW(),
                'table_name', TG_TABLE_NAME
            )
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO event_logs (event_type, payload, metadata)
        VALUES (
            TG_TABLE_NAME || '_INSERT',
            row_to_json(NEW),
            jsonb_build_object(
                'user_id', auth.uid(),
                'timestamp', NOW(),
                'table_name', TG_TABLE_NAME
            )
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为关键表创建审计触发器
CREATE TRIGGER audit_prescriptions AFTER INSERT OR UPDATE OR DELETE ON prescriptions FOR EACH ROW EXECUTE FUNCTION audit_user_actions();
CREATE TRIGGER audit_account_transactions AFTER INSERT OR UPDATE OR DELETE ON account_transactions FOR EACH ROW EXECUTE FUNCTION audit_user_actions();
CREATE TRIGGER audit_purchase_orders AFTER INSERT OR UPDATE OR DELETE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION audit_user_actions();

`;
  }

  /**
   * 生成性能优化索引
   */
  private generatePerformanceIndexes(): string {
    return `-- =========================================
-- 4. RLS性能优化索引
-- =========================================

-- 为RLS策略查询创建优化索引
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id_status ON prescriptions(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_practitioner_id_status ON orders(practitioner_id, status);
CREATE INDEX IF NOT EXISTS idx_pharmacies_operator_id ON pharmacies(operator_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_proofs_pharmacy_id_status ON fulfillment_proofs(pharmacy_id, review_status);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_user_id_created_at ON api_call_logs(user_id, created_at DESC);

-- 用户角色查询优化（基于Supabase Auth的user_metadata）
-- 注意：这些索引可能需要在auth schema中创建
-- CREATE INDEX IF NOT EXISTS idx_users_metadata_role ON auth.users USING GIN (raw_user_meta_data);

`;
  }

  /**
   * 生成权限授予语句
   */
  private generatePermissionGrants(): string {
    return `-- =========================================
-- 5. 数据库权限授予
-- =========================================

-- 授予authenticated用户基本访问权限
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 授予anon用户读取公共数据的权限（如药品信息）
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON medicines TO anon;

-- 创建安全函数权限
GRANT EXECUTE ON FUNCTION audit_user_actions() TO authenticated;

`;
  }

  /**
   * 根据表名生成基础RLS策略
   */
  generateBasicRLSForTable(tableName: string, ownerColumn: string = 'user_id'): string {
    return `-- ${tableName}表基础RLS策略
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_access_own_${tableName}" ON ${tableName}
    FOR ALL USING (
        auth.uid()::text = ${ownerColumn}::text
        OR (auth.jwt() ->> 'role')::text = 'admin'
    );

`;
  }

  /**
   * 保存生成的RLS策略到文件
   */
  async saveRLSPolicies(outputPath: string): Promise<void> {
    const policies = await this.generateRLSPolicies();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `${timestamp}_generated_rls_policies.sql`;
    
    await fs.writeFile(join(outputPath, filename), policies);
    console.log(`✅ RLS策略已保存到: ${join(outputPath, filename)}`);
  }
}

// CLI接口
export async function generateRLSPolicies(outputDir: string): Promise<void> {
  const generator = new RLSPolicyGenerator();
  
  try {
    console.log('🚀 开始RLS策略生成...');
    console.log(`📁 输出目录: ${outputDir}`);
    
    await generator.saveRLSPolicies(outputDir);
    
    console.log('🎉 RLS策略生成完成！');
    console.log('\n下一步操作：');
    console.log('1. 检查生成的策略文件');
    console.log('2. 在Supabase中执行策略: supabase db push');
    console.log('3. 测试权限控制是否正确');
    console.log('4. 监控查询性能，必要时调整索引');
    
  } catch (error) {
    console.error('❌ RLS策略生成失败:', error);
    throw error;
  }
}