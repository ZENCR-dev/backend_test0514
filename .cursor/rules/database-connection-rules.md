# 数据库连接规则与最佳实践

## 概述
本文档规定了在新西兰中医药电子处方平台开发过程中的数据库连接规范和最佳实践。

## 核心原则

### 1. 使用Supavisor连接池（必须）
- **始终使用Supavisor连接URL**进行数据库连接
- 格式：`postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
- 示例：`postgresql://postgres.ogfpdeaoknxpwzwmfnmp:YS$a!8yMy-jDxE2@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres`

### 2. 避免直接连接
- **不要使用**直接连接字符串：`db.[project-ref].supabase.co:5432`
- 原因：需要IPv6支持，大多数开发环境不支持

### 3. MCP仅用于开发辅助
- **Supabase MCP** 仅在开发编码阶段使用
- 用途：执行数据库迁移、查询数据、验证结构
- **不能**替代应用运行时的数据库连接

## 环境配置

### .env文件配置
```env
# 数据库配置
# 使用Supavisor连接池（支持IPv4和IPv6）
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"

# 直接连接（需要IPv6支持，仅作参考）
DIRECT_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
```

### Prisma配置（如使用）
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

## 连接模式选择

### 1. Transaction模式（端口6543）
- 适用于：Serverless函数、短连接应用
- 特点：不支持prepared statements
- 解决方案：
  - Prisma: 添加 `?pgbouncer=true`
  - 其他ORM: 禁用prepared statements

### 2. Session模式（端口5432）
- 适用于：需要prepared statements的场景
- 特点：支持prepared statements
- 使用：将端口改为5432

## 故障排查

### 常见错误及解决方案

1. **"Can't reach database server"**
   - 检查是否使用了Supavisor URL
   - 验证网络连接
   - 确认.env文件配置正确

2. **"prepared statement does not exist"**
   - 添加 `?pgbouncer=true` 到连接字符串
   - 或使用Session模式（端口5432）

3. **"Max client connections reached"**
   - 检查连接池配置
   - 确保正确关闭数据库连接
   - 考虑增加连接数限制

### 验证连接
```bash
# 测试数据库连接
npx prisma db pull

# 或使用psql
psql "postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
```

## 开发流程

### 1. 启动前检查
- 确保.env文件存在且配置正确
- 使用Supavisor连接字符串
- 验证网络可访问Supabase

### 2. 数据库操作
- **开发时**：可使用MCP工具执行迁移和查询
- **运行时**：必须通过配置的DATABASE_URL连接

### 3. 错误处理
```typescript
// 在PrismaService中添加连接错误处理
async onModuleInit() {
  try {
    await this.$connect();
    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    console.log("⚠️ Starting application without database connection");
    // 允许应用启动，但功能受限
  }
}
```

## 安全注意事项

1. **永不**在代码中硬编码数据库密码
2. **始终**使用环境变量管理敏感信息
3. **确保**.env文件在.gitignore中
4. **定期**轮换数据库密码

## 参考资源

- [Supabase连接池文档](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supavisor介绍](https://supabase.com/blog/supavisor-1-million)
- [IPv6迁移公告](https://github.com/orgs/supabase/discussions/17817)

---

**最后更新**: 2025-06-24
**维护者**: 后端开发团队 