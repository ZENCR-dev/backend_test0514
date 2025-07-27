## FEATURE:

新西兰中医药电子处方平台MVP2.0后端系统开发：
- 基于NestJS + TypeScript + Prisma的医疗健康平台后端API
- 四端架构：医师端、药房端、患者端、管理员端
- B2B2C差价盈利模式，医师支付处方费用，平台收取差价，药房按成本价结算
- 核心功能：处方创建管理、支付集成、实时通信、履约审核
- 隐私保护：应用层加密、基于数据归属的RBAC、统一患者身份模型
- 完整业务流程：医师开处方→支付→生成QR码→药房扫码→履约→审核→结算

## EXAMPLES:

项目根目录和src/目录包含当前实现的架构示例：
- `src/modules/prescriptions/` - 处方管理模块结构，包含controller、service、dto、repository层
- `src/auth/` - JWT认证和权限控制实现
- `src/payment/` - Stripe支付集成模式
- `src/practitioner-account/` - 医师账户管理实现
- `src/orchestration/` - WebSocket事件编排服务
- `src/common/` - 通用工具、装饰器、中间件组织方式
- `prisma/schema.prisma` - 数据模型设计参考
- `tests/` - 测试用例结构和命名规范

这些示例展示了项目的模块化架构、测试驱动开发、安全实践和业务逻辑实现模式。

## DOCUMENTATION:

核心技术文档：
- `docs/PRDSOPMVP2.0.md` - 项目总体开发指导和螺旋式开发策略
- `docs/MVP1.1_需求分析报告.md` - 详细需求分析和技术选型建议
- `docs/api/UNIFIED_API_DOCUMENTATION.md` - 统一API文档规范
- `prisma/schema.prisma` - 数据库模型定义
- `package.json` - 依赖管理和脚本配置

外部文档：
- NestJS文档：https://docs.nestjs.com/
- Prisma文档：https://www.prisma.io/docs/
- Stripe API文档：https://stripe.com/docs/api
- TypeScript文档：https://www.typescriptlang.org/docs/

## OTHER CONSIDERATIONS:

医疗平台特殊要求：
- 严格遵循隐私保护法规，患者数据必须应用层加密
- 所有API必须通过JWT认证和基于角色的访问控制
- 测试覆盖率必须>80%，遵循TDD开发模式
- API响应时间P95<300ms，数据库查询<100ms
- 单个文件不超过500行，复杂逻辑需要模块化拆分
- 必须使用TypeScript严格模式，遵循ESLint规范
- 所有敏感操作需要审计日志记录
- 支付相关功能必须通过Stripe托管，不得直接处理支付信息
- WebSocket通信用于实时状态更新和通知
- 数据库事务保证关键业务操作的原子性
- 错误处理必须友好且符合医疗行业标准
- 部署前必须通过完整的安全扫描和性能测试