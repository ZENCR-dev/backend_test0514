# API文档目录说明

**更新日期**: 2025年7月12日  
**文档状态**: ✅ 已清理完成

## 📚 当前文档结构

### 🎯 主要文档 (使用这些)

- **`UNIFIED_API_DOCUMENTATION.md`** - 📖 **唯一权威API文档**
  - 包含所有最新API端点
  - 符合当前数据库定义
  - 隐私合规版本 (v3.0)
  - **所有API开发必须以此为准**

- **`API_CHANGELOG.md`** - 📝 **API修改日志**
  - 记录所有API变更时间线
  - 版本历史和影响分析
  - **每次API修改必须更新**

### 📦 归档文档 (仅供参考)

- **`archived/`** - 🗂️ **历史版本归档**
  - `API文档.md` - 旧版本API文档
  - `API for MVP2.2.md` - MVP2.2版本文档  
  - `API for MVP2.4.md` - MVP2.4版本文档
  - `public-medicines-api.md` - 公共药品API文档
  - **⚠️ 这些文档已过时，仅供历史参考**

## 🔄 使用指南

### 前端开发团队
```bash
# 1. 始终使用统一API文档
open docs/api/UNIFIED_API_DOCUMENTATION.md

# 2. 查看API变更历史
open docs/api/API_CHANGELOG.md

# ❌ 不要使用archived目录中的文档
```

### 后端开发团队
```bash
# 1. API开发前查看当前文档
vim docs/api/UNIFIED_API_DOCUMENTATION.md

# 2. API开发后立即更新文档
vim docs/api/UNIFIED_API_DOCUMENTATION.md

# 3. 记录变更日志
vim docs/api/API_CHANGELOG.md

# 4. 遵循CLAUDE.md中的API文档管理规范
open docs/CLAUDE.md
```

## 🚨 重要提醒

1. **唯一权威性**: 只有 `UNIFIED_API_DOCUMENTATION.md` 是权威文档
2. **强制更新**: 所有API变更必须同步更新文档
3. **版本控制**: 重大变更必须增加版本号
4. **团队协作**: 前后端必须使用相同文档版本

## 📞 问题反馈

如发现文档问题或不一致，请：
1. 检查是否使用了过时的归档文档
2. 确认使用最新的统一API文档
3. 向后端团队反馈具体问题

---

**维护团队**: 后端开发团队  
**文档规范**: 详见 `docs/CLAUDE.md` 中的API文档管理规范