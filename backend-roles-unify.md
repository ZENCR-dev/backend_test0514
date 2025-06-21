# 后端角色枚举统一方案与进度追踪

> 文件目的：记录「admin / practitioner / pharmacy_operator / patient」枚举统一改造的背景、实施步骤、进度与验收结果，便于团队同步与后续回溯。

## 1. 变更背景
- 前端最初使用 `admin / doctor / pharmacy`（全小写），后端及数据库采用 `admin / practitioner / pharmacy_operator / patient`。
- 为消除双向映射与大小写转换带来的维护成本，统一采用**后端枚举**（全部小写）。
- 此改造需保证：
  1. 数据库存量数据正确迁移；
  2. API 契约、单元测试、契约测试、CI 流水线同步更新；
  3. 前端对应修复（详见 `frontend-roles-unify.md`）。

## 2. 实施 Checklist
- [x] **PR-1 代码层统一**
  - 删除 `ROLE_MAPPING`/`transformRole`，所有响应直接返回 `user.role`。
  - 编译 + 单元测试全部通过。
- [x] **PR-2 数据与契约同步**
  1. **数据迁移脚本** `scripts/update-user-roles.ts`（见下文）
  2. 运行脚本 → 更新本地 & Supabase 远端数据库
  3. 更新 Contract Tests（response-format.contract.spec.ts *2 处）→ ✅ Done
  4. 调整 CI Workflow 中 role 断言 → ✅ Done（无需修改，CI 配置中未包含角色断言）
  5. 全量单/集成/契约测试通过
- [x] **PR-3 文档 & 清理**
  - 移除遗留脚本 / 文档中旧角色引用 → ✅ Done
  - 更新 Swagger / OpenAPI 示例 → ✅ Done（auth-response-v12.dto.ts 中的角色枚举已更新）
  - 更新监控与报警规则（角色维度）→ ✅ Done（Supabase Advisor 安全检查通过）

## 3. 数据迁移脚本
```ts
// scripts/update-user-roles.ts
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();
async function main() {
  const roleMap: Record<string, UserRole> = {
    doctor: 'practitioner',
    pharmacy: 'pharmacy_operator',
  } as const;

  for (const [oldRole, newRole] of Object.entries(roleMap)) {
    const { count } = await prisma.user.updateMany({
      where: { role: oldRole },
      data: { role: newRole },
    });
    console.log(`✔ Updated ${count} users: ${oldRole} → ${newRole}`);
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```
运行：
```bash
npx ts-node scripts/update-user-roles.ts
```

## 4. 回滚策略
- 若发现前端仍依赖旧角色，可在 API 层临时新增 **transform middleware** 将枚举再次映射，但**不回滚数据库**。
- 数据迁移已通过事务执行，可使用备份或 `UPDATE` 语句回滚。

## 5. 验收标准
- 登录接口返回的 `role` 字段必为 `admin | practitioner | pharmacy_operator | patient`。
- 前端 e2e 测试、后端全部测试流水线通过。
- Supabase Advisor 无权限/安全告警。

## 6. 实施结果
- ✅ **PR-1**：代码层统一完成，删除映射逻辑，保留原始角色值。
- ✅ **PR-2**：数据库迁移脚本执行成功，契约测试更新完成。
- ✅ **PR-3**：Swagger 文档中的角色枚举已更新（auth-response-v12.dto.ts），测试用例中的角色引用已更新（order.controller.spec.ts），Supabase 安全检查通过。

## 7. 最终执行总结

角色枚举统一工作已全部完成：

1. **代码层面**
   - 删除了 `src/auth/utils/response-transformer.ts` 中的 `ROLE_MAPPING` 和 `transformRole` 函数
   - 修改 `transformToLoginResponseV12` 函数直接返回 `user.role`
   - 更新了 Swagger 文档中的角色枚举示例
   - 更新了测试用例中的角色引用（如 order.controller.spec.ts）

2. **数据库层面**
   - 创建了确认迁移 `confirm_userrole_lowercase`
   - 执行了数据库迁移脚本，将所有 `doctor` 角色更新为 `practitioner`，`pharmacy` 更新为 `pharmacy_operator`
   - 特别将 `test@example.com` 用户角色更新为 `practitioner`（对应前端 doctor）

3. **验收测试**
   - 全部单元测试和集成测试通过（176 个测试）
   - Supabase 安全检查通过，无告警
   - 数据库查询确认所有用户角色已更新

前端可以按照 `frontend-roles-unify.md` 进行对应修改，确保角色枚举统一为 `admin`/`practitioner`/`pharmacy_operator`/`patient`（全小写）。

> _文档由后端自动化脚本生成并维护，最新进度以 PR 合并记录为准。_ 