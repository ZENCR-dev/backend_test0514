# RIPER-5阶段能力白名单

## 阶段定义与能力映射

### RESEARCH（研究阶段）
**允许的能力**：
- `/analyze` - 代码分析
- `/scan` - 代码扫描
- Context7 - 上下文检索
- Sequential - 顺序分析
- Read - 文件读取
- Grep - 内容搜索
- Glob - 文件匹配

**限制**：
- 仅限信息收集、结构分析、上下文检索
- 不允许修改任何文件
- 不允许执行构建或部署命令

### INNOVATE（创新阶段）
**允许的能力**：
- `/review` - 代码审查
- `/explain` - 代码解释
- `/troubleshoot` - 问题诊断
- Persona切换 - 角色切换
- WebFetch - 网络信息获取
- WebSearch - 网络搜索

**限制**：
- 仅限头脑风暴、方案对比
- 不允许做最终决策
- 不允许实施任何解决方案

### PLAN（规划阶段）
**允许的能力**：
- `/plan` - 制定计划
- `/generate-prp` - 生成PRP蓝图
- `/task` - 任务管理
- `/document` - 文档生成
- TodoWrite - 任务清单管理
- Write - 文档写入

**限制**：
- 仅限输出详细方案、Checklist、PRP蓝图
- 不允许实际实现功能
- 不允许修改源代码

### EXECUTE（执行阶段）
**允许的能力**：
- `/build` - 构建项目
- `/test` - 运行测试
- `/deploy` - 部署应用
- `/migrate` - 数据迁移
- `/cleanup` - 清理操作
- Edit - 文件编辑
- MultiEdit - 批量编辑
- Bash - 命令执行

**限制**：
- 仅限按Checklist逐步实现
- 不允许偏离既定计划
- 必须严格遵循安全规范

### REVIEW（审查阶段）
**允许的能力**：
- `/review` - 代码审查
- `/scan` - 安全扫描
- `/test` - 测试验证
- `/document` - 文档更新
- Read - 文件读取
- Grep - 内容搜索

**限制**：
- 仅限核查与验收
- 不允许修改实现
- 只能提出改进建议

## 模式切换规则

### 自动判定
AI根据用户提示词中的关键词自动判定当前模式：
- "分析"、"了解"、"查看" → RESEARCH
- "设计"、"构思"、"建议" → INNOVATE  
- "规划"、"计划"、"任务" → PLAN
- "实现"、"开发"、"构建" → EXECUTE
- "检查"、"验证"、"审查" → REVIEW

### 强制切换
用户可使用命令强制切换：
- `ENTER RESEARCH MODE`
- `ENTER INNOVATE MODE`
- `ENTER PLAN MODE`
- `ENTER EXECUTE MODE`
- `ENTER REVIEW MODE`

### 模式确认
遇到歧义或高风险操作时，AI必须主动请求用户确认当前模式。