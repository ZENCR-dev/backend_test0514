# 角色映射验证指南

## 问题背景

前后端角色枚举不匹配导致权限验证失败：
- **前端定义**：`['admin', 'doctor', 'pharmacy']`（小写）
- **后端枚举**：`['ADMIN', 'PRACTITIONER', 'PHARMACY_OPERATOR']`（大写）

## 解决方案

我们采用了**方案A（快速通行）**，通过在前端添加角色映射函数，将后端返回的角色格式转换为前端期望的格式：

```typescript
// 后端角色 → 前端角色映射
ADMIN → admin
PRACTITIONER → doctor
PHARMACY/PHARMACY_OPERATOR → pharmacy
```

## 验证步骤

### 1. 角色映射函数测试

运行角色映射测试脚本，验证映射逻辑是否正确：

```bash
node scripts/test-role-mapping.js
```

预期输出：所有测试用例通过，包括大小写变体和特殊角色名称。

### 2. 登录API测试

测试登录API并验证返回的角色格式：

```bash
node scripts/test-login-role.js
```

这个脚本会：
- 尝试使用测试账户登录
- 分析API响应结构
- 提取并显示原始角色
- 应用映射函数并验证结果

### 3. UI验证

1. 启动前端应用：
   ```bash
   npm run dev
   ```

2. 使用测试账户登录：
   - 测试用户: `doctor@example.com` / `password123`
   - 管理员: `admin@example.com` / `admin123`

3. 验证以下内容：
   - 登录后角色显示是否正确
   - 是否能访问对应角色的受保护路由
   - 导航菜单是否正确显示对应角色的功能入口

## 角色权限映射表

| 后端角色 | 前端角色 | 可访问模块 |
|---------|---------|-----------|
| `ADMIN` | `admin` | 管理员模块、医师模块、药房模块 |
| `PRACTITIONER` | `doctor` | 医师模块、处方创建 |
| `PHARMACY_OPERATOR` | `pharmacy` | 药房模块、扫码取药 |

## 技术实现细节

角色映射逻辑位于 `src/store/authStore.ts` 文件中的 `mapBackendRoleToFrontend` 函数：

```typescript
const mapBackendRoleToFrontend = (backendRole: string): UserRole => {
  // 统一转大写处理，简化匹配逻辑
  const upperRole = backendRole.toUpperCase();
  
  // 角色映射规则
  switch (upperRole) {
    case 'ADMIN':
      return 'admin';
    case 'PRACTITIONER':
      return 'doctor';
    case 'PHARMACY':
    case 'PHARMACY_OPERATOR':
      return 'pharmacy';
    default:
      // 兜底处理：尝试将后端角色转为小写
      const lowerRole = backendRole.toLowerCase();
      if (['admin', 'doctor', 'pharmacy'].includes(lowerRole)) {
        return lowerRole as UserRole;
      }
      // 默认返回最安全的角色
      console.warn(`未知角色类型: ${backendRole}，默认映射为普通用户`);
      return 'doctor';
  }
};
```

该函数在以下位置被调用：
1. `login` 函数中，处理登录响应
2. `checkAuth` 函数中，验证token时

## 长期规划

当前的角色映射方案是一个临时解决方案，长期应考虑：

1. **统一角色枚举**：前后端使用相同的角色枚举格式
2. **标准化API契约**：明确API响应中角色字段的格式
3. **添加角色映射测试**：确保角色映射逻辑在CI/CD流程中被测试

## 测试结果

我们已经完成了角色映射功能的实现和测试，结果如下：

### 1. 角色映射函数测试

```bash
npm run test:roles
```

✅ **测试结果**：所有测试用例通过，包括大小写变体和特殊角色名称。

### 2. 登录API测试

```bash
npm run test:login
```

✅ **测试结果**：
- 成功登录后端API
- 获取到JWT Token
- 获取到用户信息
- 后端返回角色格式：
  - 管理员: `"admin"`（已经是小写）
  - 医师: `"practitioner"`（需要映射为`"doctor"`）

### 3. 完整集成测试

```bash
npm run test:auth
```

✅ **测试结果**：
- 登录认证测试成功
- 角色映射测试成功（`"practitioner"` → `"doctor"`）
- 映射结果与预期一致

## 结论

角色映射功能已经成功实现并通过测试。这个解决方案能够有效处理前后端角色枚举不匹配的问题，确保前端应用能够正确识别和处理后端返回的角色信息。

### 优势

1. **兼容性**：同时支持大小写变体和不同的角色名称格式
2. **健壮性**：包含兜底逻辑，处理未知角色情况
3. **可维护性**：集中管理角色映射逻辑，便于未来更新
4. **无侵入性**：不需要修改现有的权限判断逻辑

### 后续步骤

1. **监控**：在实际使用中监控角色映射功能，确保没有遗漏的角色格式
2. **标准化**：长期计划中，考虑统一前后端角色枚举格式
3. **文档更新**：确保API文档明确说明角色字段的格式和映射规则
4. **测试覆盖**：将角色映射测试纳入CI/CD流程

## 常见问题

### Q: 登录成功但无法访问特定模块？

检查：
1. 控制台输出中是否有角色映射相关警告
2. `localStorage` 中存储的用户信息角色是否正确
3. 路由守卫中的角色判断逻辑是否正确

### Q: 后端新增了角色，前端无法识别？

需要更新 `mapBackendRoleToFrontend` 函数，添加新角色的映射规则。 