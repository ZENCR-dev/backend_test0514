# Roles Enum Unification Plan

> 目标：前后端统一使用全小写角色枚举 `admin | practitioner | pharmacy_operator | patient`；删除映射函数，保证现有功能、测试全部通过。
>
> 约束：
> • **每个 Phase 的代码改动 ≤ 50 行**（新增 + 删除）。
> • **测试优先**：先调整/编写测试 → 再改业务实现 → 测试通过后再进入下一 Phase。
> • 完成一个 Phase 后必须回到本文在「进度记录」区填入 ✅ 才能开始下一个 Phase。

---
## Phase-0 基线准备
| 子步骤 | 说明 |
| --- | --- |
| 0-1 | 新建本文档并提交 PR（仅文档）。 |
| 0-2 | 新增 `roles.refactor.spec.ts`：断言四个枚举字符串存在。 |
| 0-3 | CI 通过后在下表记录 ✅ |

### 预期测试
```ts
expect(['admin','practitioner','pharmacy_operator','patient']).toContain('admin');
```

---
## Phase-1 类型层（≤40 行）
1. 修改 `src/types/auth.ts` →
```ts
export type UserRole = 'admin' | 'practitioner' | 'pharmacy_operator' | 'patient';
```
2. 更新其它类型文件仅涉及 import/引用。
3. 更新/新增单元测试 `types/auth.test.ts`。

**通过标准**
- `npm run test` 全绿。

---
## Phase-2 状态 & 鉴权层（≤50 行）
1. 删除 `mapBackendRoleToFrontend` 与所有调用。
2. `login` / `checkAuth` / `withAuth` 直接使用后端枚举。
3. 添加一次性本地迁移：检测旧小写角色（doctor/pharmacy）→ 对应新枚举并覆盖。本函数放置于 `initializeAuth`，写完单元测试。

**测试**
- `authStore.test.ts`：模拟旧 localStorage 值，调用 `initializeAuth`，期望 `practitioner`。

---
## Phase-3 业务组件层
### 3-A Layout & 主入口（≤50 行）
- 替换 `role === 'doctor'` → `'practitioner'`；`'pharmacy'` → `'pharmacy_operator'`。
- 更新 `allowedRoles` 数组。
- 相关 RTL 测试更新。

### 3-B 其余组件（≤50 行）
- 完成剩余比较与数组替换。
- 相应测试修正。

**测试**
- 页面快照 & 条件渲染断言依旧通过。

---
## Phase-4 Mock / Service 层（≤40 行）
1. 更新 `mocks/**` 用户对象 `role` 字段。
2. 更新 `services/**` 任何硬编码角色。
3. 契约测试白名单改为新枚举。

**测试**
- 运行 `npm run test` + 契约测试脚本，全绿。

---
## Phase-5 脚本 & 工具（≤30 行）
1. 删除角色映射测试脚本与函数。
2. 更新 `scripts/test-login-role.mjs` 直接断言枚举。
3. `package.json` 命令同步。

**测试**
- `npm run test:login` 返回角色应为 `practitioner`。

---
## Phase-6 文档收尾（非代码）
1. 在旧映射文档顶部加 `DEPRECATED`。  
2. 新建 `docs/roles.md` 说明新枚举。  
3. 更新 README 示例角色。

---
## Phase-7 终局验证
1. 后端将 `test@example.com` role 改为 `practitioner`。
2. 运行端到端脚本 & 手动登录 `/doctor` 页面。
3. 清理一次性迁移函数（单独 PR ≤20 行）。

---
## 进度记录
| Phase | 完成情况 | PR / Commit | 负责 | 日期 |
| --- | --- | --- | --- | --- |
| Phase-0 | ⬜ | | | |
| Phase-1 | ⬜ | | | |
| Phase-2 | ⬜ | | | |
| Phase-3A | ⬜ | | | |
| Phase-3B | ⬜ | | | |
| Phase-4 | ⬜ | | | |
| Phase-5 | ⬜ | | | |
| Phase-6 | ⬜ | | | |
| Phase-7 | ⬜ | | | |

---
> **备注**：若某子步骤实际修改行数 >50 行，需再拆成更小的 PR 并在「进度记录」另起行标记。 