# 数据库迁移需求 - PractitionerAccount表

**日期**: 2025-06-28  
**状态**: ✅ 已完成

## 需求说明

架构重构已完成，PractitionerAccount表已通过Supabase MCP工具成功创建。

## 迁移完成详情

**执行时间**: 2025-06-28 19:43  
**执行方式**: Supabase MCP apply_migration  
**影响的表**:
- ✅ 创建 `practitioner_accounts` 表
- ✅ 创建 `event_logs` 表  
- ✅ 更新 `account_transactions` 外键关系

## 原计划命令（已通过MCP完成）

```bash
# 1. 创建迁移
npx prisma migrate dev --name add_practitioner_accounts

# 2. 应用到数据库
npx prisma migrate deploy
```

## 表结构

PractitionerAccount表已在`prisma/schema.prisma`中定义，包含以下字段：
- id: 主键
- practitionerId: 医师ID（外键关联User表）
- balance: 余额
- creditLimit: 信用额度
- usedCredit: 已使用额度
- availableCredit: 可用额度
- status: 账户状态
- version: 版本号（用于乐观锁）
- 时间戳字段

## 注意事项

1. 确保数据库连接正常
2. 建议先在测试环境执行
3. 执行前备份现有数据 