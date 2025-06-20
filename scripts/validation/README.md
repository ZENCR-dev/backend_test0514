# 数据质量检查脚本

TCM处方平台的数据完整性和一致性验证工具

## 概述

数据质量检查脚本是一个全面的数据验证工具，旨在确保TCM处方平台数据库的数据质量、一致性和完整性。该脚本执行多种检查，从基础连接验证到复杂的业务规则验证。

## 功能特性

### 🔍 检查类别

1. **连接检查 (CONNECTION)**
   - 数据库连接验证
   - 基础可用性测试

2. **架构检查 (SCHEMA)**
   - 表结构验证
   - 必需表存在性检查

3. **一致性检查 (CONSISTENCY)**
   - 用户-档案映射
   - 诊所-账户映射
   - 跨表数据一致性

4. **完整性检查 (INTEGRITY)**
   - 外键完整性
   - 引用完整性验证
   - 孤立记录检测

5. **业务规则检查 (BUSINESS)**
   - 用户角色验证
   - 订单状态验证
   - 金额一致性检查
   - 账户余额逻辑

6. **统计分析 (STATISTICS)**
   - 数据分布分析
   - 状态统计
   - 趋势分析

7. **质量检查 (QUALITY)**
   - 空值检测
   - 重复数据检查
   - 数据格式验证

8. **性能指标 (PERFORMANCE)**
   - 表大小分析
   - 索引使用情况
   - 查询性能指标

## 安装要求

### 依赖项
```bash
npm install @prisma/client typescript tsx
```

### 环境变量
确保以下环境变量已配置：
```env
DATABASE_URL="postgresql://username:password@localhost:5432/tcm_platform"
```

## 使用方法

### 基础用法

1. **直接运行脚本**
```bash
npx tsx scripts/validation/data-quality-check.ts
```

2. **使用Node.js**
```bash
node -r esbuild-register scripts/validation/data-quality-check.ts
```

### 编程方式使用

```typescript
import { DataQualityChecker } from './scripts/validation/data-quality-check';

const checker = new DataQualityChecker();
const report = await checker.runAllChecks();

console.log(`总测试数: ${report.summary.totalTests}`);
console.log(`通过: ${report.summary.passedTests}`);
console.log(`失败: ${report.summary.failedTests}`);
console.log(`警告: ${report.summary.warningTests}`);
console.log(`整体状态: ${report.summary.overallStatus}`);
```

### 测试

运行测试套件：
```bash
npm test scripts/validation/__tests__/data-quality-check.test.ts
```

## 配置

### 配置文件
`scripts/validation/data-quality-config.json` 包含以下配置选项：

```json
{
  "validation_rules": {
    "required_tables": ["users", "medicines", ...],
    "business_rules": {
      "user_roles": ["practitioner", "patient", ...],
      "order_status": ["DRAFT", "PAID", ...]
    },
    "data_quality_thresholds": {
      "max_null_percentage": 5,
      "max_duplicate_percentage": 1
    }
  },
  "execution_settings": {
    "timeout_seconds": 300,
    "retry_attempts": 3,
    "verbose_logging": true
  }
}
```

## 报告输出

### 报告格式

检查完成后会生成JSON格式的详细报告：

```json
{
  "summary": {
    "totalTests": 45,
    "passedTests": 42,
    "failedTests": 1,
    "warningTests": 2,
    "overallStatus": "WARNING",
    "executionTime": 2345
  },
  "results": [
    {
      "category": "CONNECTION",
      "test": "Database Connectivity",
      "status": "PASS",
      "message": "Database connection successful",
      "timestamp": "2024-06-19T15:30:00Z"
    }
  ],
  "metadata": {
    "databaseVersion": "PostgreSQL",
    "schemaVersion": "1.0",
    "executedAt": "2024-06-19T15:30:00Z",
    "executedBy": "Data Quality Checker v1.0"
  }
}
```

### 状态等级

- **EXCELLENT**: 所有测试通过，无警告
- **WARNING**: 有警告但无关键失败
- **CRITICAL**: 有关键测试失败

### 报告保存

报告自动保存到：
```
scripts/validation/data-quality-report-YYYY-MM-DD.json
```

## 集成指南

### CI/CD 集成

在GitHub Actions中使用：

```yaml
name: Data Quality Check
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  data-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run data quality check
        run: npx tsx scripts/validation/data-quality-check.ts
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### 定期监控

设置cron任务进行定期检查：

```bash
# 每日凌晨2点执行数据质量检查
0 2 * * * cd /path/to/project && npx tsx scripts/validation/data-quality-check.ts
```

## 故障排除

### 常见问题

1. **数据库连接失败**
   ```
   错误: Database connection failed
   解决: 检查DATABASE_URL环境变量和数据库可用性
   ```

2. **权限不足**
   ```
   错误: Permission denied for relation
   解决: 确保数据库用户有读取权限
   ```

3. **内存不足**
   ```
   错误: JavaScript heap out of memory
   解决: 增加Node.js内存限制 --max-old-space-size=4096
   ```

### 调试模式

启用详细日志：
```bash
DEBUG=true npx tsx scripts/validation/data-quality-check.ts
```

## 扩展检查

### 添加自定义检查

```typescript
class CustomDataQualityChecker extends DataQualityChecker {
  async checkCustomBusinessRule(): Promise<void> {
    try {
      // 自定义业务规则检查
      const result = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM custom_table 
        WHERE custom_condition
      `;
      
      if (Number(result[0]?.count || 0) === 0) {
        await this.log('CUSTOM', 'Custom Rule', 'PASS', 'Custom check passed');
      } else {
        await this.log('CUSTOM', 'Custom Rule', 'FAIL', 'Custom check failed');
      }
    } catch (error) {
      await this.log('CUSTOM', 'Custom Rule', 'FAIL', 'Custom check error', error);
    }
  }

  async runAllChecks(): Promise<QualityReport> {
    // 运行基础检查
    const report = await super.runAllChecks();
    
    // 添加自定义检查
    await this.checkCustomBusinessRule();
    
    return this.generateReport();
  }
}
```

## 最佳实践

### 运行频率建议

- **开发环境**: 每次部署前
- **测试环境**: 每日一次
- **生产环境**: 每周一次或数据变更后

### 性能优化

1. **并行执行**: 启用parallel_execution配置
2. **选择性检查**: 只运行必要的检查类别
3. **索引优化**: 确保查询相关字段有索引

### 监控告警

设置告警条件：
- 失败测试数 > 0
- 警告测试数 > 5
- 执行时间 > 5分钟

## 版本历史

- **v1.0** (2024-06-19): 初始版本，包含基础数据质量检查功能

## 支持

如有问题或建议，请：
1. 查看故障排除部分
2. 检查配置文件
3. 联系开发团队

## 许可证

本脚本为TCM处方平台内部工具，仅供项目内部使用。 