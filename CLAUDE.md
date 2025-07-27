# CLAUDE.md（AI协作与权限极简规范·强制版）

## 1. 模式与阶段识别

- AI每次响应必须以 `[MODE: 模式名]` 开头，声明当前RIPER-5模式。
- AI必须根据用户提示词中的关键词、意图和上下文自动判定当前RIPER-5模式。如遇歧义或涉及高风险操作，AI必须主动请求用户确认当前模式。
- 用户可随时通过“ENTER [MODE] MODE”命令强制切换模式，AI必须立即切换。

## 2. 阶段-能力白名单映射

- 各RIPER-5阶段允许AI调用的命令/工具/能力如下表。AI不得调用未列入白名单的能力。用户可在CLAUDE.md或对话中增删白名单内容，AI必须严格遵守。

| 阶段      | 允许AI调用的能力（白名单）         | 说明/限制                         |
|-----------|-----------------------------------|-----------------------------------|
| RESEARCH  | /analyze, /scan, Context7, Sequential | 仅限信息收集、结构分析、上下文检索   |
| INNOVATE  | /review, /explain, /troubleshoot, Persona切换 | 仅限头脑风暴、方案对比，不得做决策     |
| PLAN      | /plan, /generate-prp, /task, /document | 仅限输出详细方案、Checklist、PRP蓝图，不得实现 |
| EXECUTE   | /build, /test, /deploy, /migrate, /cleanup | 仅限按Checklist逐步实现，不得偏离     |
| REVIEW    | /review, /scan, /test, /document   | 仅限核查与验收，不得修改             |

## 3. PRP蓝图与上下文引用规则

- PRP蓝图仅允许在PLAN阶段、且用户明确要求时生成。AI不得在其他阶段生成或补全PRP蓝图。
- AI补充上下文时，必须引用真实存在的文件、示例或文档。不得凭空补全、杜撰或产生幻觉内容。
- 所有上下文引用必须以“文件/路径/行号/链接”形式明确标注。

## 4. 多层级任务树与Checklist管理

- 所有任务分解、Checklist、PRP任务列表必须采用“任务树”结构，支持多层级嵌套。
- AI每次执行或汇报时，必须输出当前任务树路径（如：主任务>子任务>当前todo），并支持回溯和跳转。
- AI在执行最低层级todos后，必须自动回溯到上级任务，禁止任务迷失。
- 任务树状态必须持久化于`.tasks/`或`progress.md`等文件，确保多轮协作时任务状态可追溯。

## 5. 文档精简与上下文窗口控制

- CLAUDE.md仅保留上述五大核心段落。所有详细命令、Persona、PRP模板、最佳实践等内容必须以“参考：xxx.md”形式外部引用，不得直接写入主文档。
- 每段内容不得超过10行。禁止冗余描述。AI响应时仅允许引用高相关性规则，低相关性内容必须省略。

---

**扩展说明：**
- 如需扩展命令、Persona、PRP模板等，必须在本文件末尾以“参考：xxx.md”形式补充，不得直接写入主文档。
- 本规范适用于所有Claude Code项目，兼容SuperClaude、Context Engineering、RIPER-5等主流AI协作框架。

--- 