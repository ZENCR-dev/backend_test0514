# ApiLogQueryService 底层任务树 - 最小执行单位

**基于**: MVP2.5-DEVELOPMENT-PLAN.md 中层TODO 4.1.1-4.1.7  
**原则**: 测试驱动开发，每个任务单位 ≤ 15分钟  
**验证**: 每个任务都有明确的测试验证标准

---

## 🎯 TODO 4.1.1: 创建DTO文件架构 (30分钟)

### 底层任务单位:

#### ☐ T4.1.1.1: 创建基础DTO类 (10分钟)
**文件**: `src/common/dto/api-log-query.dto.ts`
**测试验证**: 
```bash
# 编译测试
npm run build
# 类型检查
npx tsc --noEmit
```
**完成标准**: 
- [ ] ApiLogQueryDto类包含所有基础字段
- [ ] 所有字段有适当的验证装饰器
- [ ] API文档注解完整

#### ☐ T4.1.1.2: 创建统计查询DTO (10分钟)  
**文件**: 同上文件，新增类
**测试验证**:
```bash
# 验证DTO导入
node -e "console.log(require('./dist/src/common/dto/api-log-query.dto.js'))"
```
**完成标准**:
- [ ] ApiLogStatsQueryDto类创建完成
- [ ] 包含聚合查询相关字段
- [ ] 继承基础DTO的通用字段

#### ☐ T4.1.1.3: 创建导出DTO (10分钟)
**文件**: 同上文件，新增类
**测试验证**:
```bash
# 验证所有DTO类导出
node -e "const dto = require('./dist/src/common/dto/api-log-query.dto.js'); console.log(Object.keys(dto))"
```
**完成标准**:
- [ ] ApiLogExportDto类创建完成
- [ ] 包含导出格式和范围字段
- [ ] 所有DTO类正确导出

---

## 🎯 TODO 4.1.2: 实现核心查询服务 (90分钟)

### 底层任务单位:

#### ☐ T4.1.2.1: 创建服务基础结构 (15分钟)
**文件**: `src/common/services/api-log-query.service.ts`
**测试验证**:
```bash
# 服务注入测试
npm run test -- --testNamePattern="ApiLogQueryService.*should be defined"
```
**完成标准**:
- [ ] 服务类创建，包含基础依赖注入
- [ ] PrismaService和Logger正确注入
- [ ] 基础构造函数和初始化方法

#### ☐ T4.1.2.2: 实现where条件构建器 (15分钟)
**方法**: `private buildWhereCondition(query: ApiLogQueryDto)`
**测试验证**:
```bash
# 单元测试where条件构建
npm run test -- --testNamePattern="buildWhereCondition"
```
**完成标准**:
- [ ] 支持endpoint模糊匹配
- [ ] 支持method精确匹配
- [ ] 支持statusCode范围查询
- [ ] 支持userId精确匹配
- [ ] 支持时间范围查询

#### ☐ T4.1.2.3: 实现基础查询方法 (15分钟)
**方法**: `async queryApiLogs(query: ApiLogQueryDto)`
**测试验证**:
```bash
# 基础查询功能测试
npm run test -- --testNamePattern="queryApiLogs.*basic query"
```
**完成标准**:
- [ ] 返回分页结果
- [ ] 支持排序（默认按时间倒序）
- [ ] 包含总数统计
- [ ] 错误处理机制

#### ☐ T4.1.2.4: 实现查询性能优化 (15分钟)
**优化**: 索引使用和查询计划
**测试验证**:
```bash
# 性能测试
npm run test -- --testNamePattern="queryApiLogs.*performance"
```
**完成标准**:
- [ ] 查询使用适当索引
- [ ] 基础查询响应时间 < 200ms
- [ ] 大数据量查询优化

#### ☐ T4.1.2.5: 实现统计计算方法 (15分钟)
**方法**: `async getApiLogStats(query: ApiLogStatsQueryDto)`
**测试验证**:
```bash
# 统计功能测试
npm run test -- --testNamePattern="getApiLogStats"
```
**完成标准**:
- [ ] 请求总数统计
- [ ] 成功率计算
- [ ] 平均响应时间
- [ ] 错误率统计

#### ☐ T4.1.2.6: 添加错误处理和日志 (15分钟)
**功能**: 完善错误处理机制
**测试验证**:
```bash
# 错误处理测试
npm run test -- --testNamePattern="error handling"
```
**完成标准**:
- [ ] 数据库连接错误处理
- [ ] 查询参数验证错误处理
- [ ] 详细的错误日志记录
- [ ] 优雅的错误响应

---

## 🎯 TODO 4.1.3: 实现高级查询方法 (60分钟)

### 底层任务单位:

#### ☐ T4.1.3.1: 实现实时统计方法 (20分钟)
**方法**: `async getRealTimeStats()`
**测试验证**:
```bash
npm run test -- --testNamePattern="getRealTimeStats"
```
**完成标准**:
- [ ] 最近1小时请求统计
- [ ] 当前活跃用户数
- [ ] 实时错误率监控

#### ☐ T4.1.3.2: 实现用户活动统计 (20分钟)
**方法**: `async getUserActivityStats(query: ApiLogStatsQueryDto)`
**测试验证**:
```bash
npm run test -- --testNamePattern="getUserActivityStats"
```
**完成标准**:
- [ ] 用户请求频率统计
- [ ] 用户行为模式分析
- [ ] 活跃用户排行

#### ☐ T4.1.3.3: 实现导出功能 (20分钟)
**方法**: `async exportApiLogs(query: ApiLogExportDto)`
**测试验证**:
```bash
npm run test -- --testNamePattern="exportApiLogs"
```
**完成标准**:
- [ ] 支持CSV格式导出
- [ ] 支持JSON格式导出
- [ ] 大数据量分批导出
- [ ] 导出进度跟踪

---

## 🎯 TODO 4.1.4: 集成到CommonModule (15分钟)

### 底层任务单位:

#### ☐ T4.1.4.1: 注册服务提供者 (8分钟)
**文件**: `src/common/common.module.ts`
**测试验证**:
```bash
# 模块编译测试
npm run build
```
**完成标准**:
- [ ] ApiLogQueryService添加到providers
- [ ] 服务正确导出

#### ☐ T4.1.4.2: 验证模块集成 (7分钟)
**测试**: 模块导入测试
**测试验证**:
```bash
# 集成测试
npm run test -- --testNamePattern="CommonModule.*ApiLogQueryService"
```
**完成标准**:
- [ ] 服务可以正确注入
- [ ] 模块编译无错误
- [ ] 依赖关系正确解析

---

## 🎯 TODO 4.1.5: 创建单元测试 (45分钟)

### 底层任务单位:

#### ☐ T4.1.5.1: 创建测试基础结构 (15分钟)
**文件**: `src/common/services/__tests__/api-log-query.service.spec.ts`
**测试验证**:
```bash
npm run test -- --testNamePattern="ApiLogQueryService.*should be defined"
```
**完成标准**:
- [ ] 测试模块配置完成
- [ ] Mock依赖设置完成
- [ ] 基础测试用例通过

#### ☐ T4.1.5.2: 测试核心查询功能 (15分钟)
**测试范围**: queryApiLogs方法
**测试验证**:
```bash
npm run test -- --testNamePattern="queryApiLogs"
```
**完成标准**:
- [ ] 基础查询测试
- [ ] 过滤条件测试
- [ ] 分页功能测试
- [ ] 排序功能测试

#### ☐ T4.1.5.3: 测试统计功能 (15分钟)
**测试范围**: 统计相关方法
**测试验证**:
```bash
npm run test -- --testNamePattern="Stats"
```
**完成标准**:
- [ ] 基础统计测试
- [ ] 实时统计测试
- [ ] 用户活动统计测试
- [ ] 边界条件测试

---

## 🎯 TODO 4.1.6: 性能优化验证 (30分钟)

### 底层任务单位:

#### ☐ T4.1.6.1: 查询性能测试 (15分钟)
**测试脚本**: 创建性能测试脚本
**测试验证**:
```bash
# 性能测试脚本
node tmp_rovodev_performance_test_apilog.js
```
**完成标准**:
- [ ] 基础查询 < 200ms
- [ ] 统计查询 < 500ms
- [ ] 大数据量查询优化验证

#### ☐ T4.1.6.2: 索引使用验证 (15分钟)
**验证**: 数据库查询计划分析
**测试验证**:
```bash
# 索引使用分析
node tmp_rovodev_index_analysis.js
```
**完成标准**:
- [ ] 查询使用适当索引
- [ ] 无全表扫描
- [ ] 查询计划优化

---

## 🎯 TODO 4.1.7: 集成测试 (30分钟)

### 底层任务单位:

#### ☐ T4.1.7.1: 端到端集成测试 (15分钟)
**测试**: 完整的API调用流程
**测试验证**:
```bash
npm run test:e2e -- --testNamePattern="ApiLogQuery.*integration"
```
**完成标准**:
- [ ] 完整查询流程测试
- [ ] 错误场景测试
- [ ] 性能基准测试

#### ☐ T4.1.7.2: 服务集成测试 (15分钟)
**测试**: 与现有服务的兼容性
**测试验证**:
```bash
npm run test -- --testNamePattern="service.*integration"
```
**完成标准**:
- [ ] 与ApiLoggingService集成测试
- [ ] 与其他Common服务集成测试
- [ ] 模块间依赖测试

---

## 📊 进度跟踪机制

### 完成度检查点:
- **25%完成**: TODO 4.1.1-4.1.2 (DTO + 核心服务)
- **50%完成**: TODO 4.1.3-4.1.4 (高级功能 + 模块集成)  
- **75%完成**: TODO 4.1.5-4.1.6 (测试 + 性能优化)
- **100%完成**: TODO 4.1.7 (集成测试)

### 验证命令汇总:
```bash
# 完整测试套件
npm run test -- --testPathPattern="api-log-query"
npm run test:e2e -- --testNamePattern="ApiLogQuery"
npm run build

# 性能验证
node tmp_rovodev_performance_test_apilog.js
node tmp_rovodev_index_analysis.js
```

### 清理任务:
```bash
# 删除临时文件
rm tmp_rovodev_performance_test_apilog.js
rm tmp_rovodev_index_analysis.js
rm tmp_rovodev_bottom_layer_todos_apilogqueryservice.md
```