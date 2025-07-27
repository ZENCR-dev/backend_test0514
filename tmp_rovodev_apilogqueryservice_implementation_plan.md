# ApiLogQueryService 深度实现方案

**制定时间**: 2025年7月15日 21:45  
**基于**: .claude/全局规范 + RIPER-5工作流 + 现有代码库分析  
**目标**: A. 开发ApiLogQueryService - 实现标准化查询接口

---

## 📋 RIPER-5 PLAN模式分析

### RESEARCH阶段发现总结

**现有基础设施分析**:
1. ✅ **ApiLoggingService**: 完整的数据收集和持久化 (363行)
2. ✅ **数据模型**: ApiCallLog + ApiCallMetrics 完整设计
3. ✅ **索引策略**: 6个优化索引支持高效查询
4. ✅ **参考模式**: GlobalQueriesService提供完整的查询模式参考

**关键发现**:
- ApiCallLog表结构完整: endpoint, method, statusCode, userId, duration等核心字段
- 现有查询模式: GlobalQueriesService展示了标准化查询接口的最佳实践
- 索引优化: 复合索引支持(userId, createdAt), (endpoint, createdAt)等高频查询

---

## 🎯 ApiLogQueryService 设计方案

### 1. 核心架构设计

**服务定位**: 
- 位置: `src/common/services/api-log-query.service.ts`
- 角色: API日志查询的标准化服务层
- 模式: 复用GlobalQueriesService的成功模式

**依赖关系**:
```typescript
ApiLogQueryService
├── PrismaService (数据访问)
├── Logger (日志记录)
└── ApiLoggingService (配置共享)
```

### 2. DTO设计 - 基于现有模式

**参考**: GlobalPrescriptionsQueryDto的完整设计模式

```typescript
// src/common/dto/api-log-query.dto.ts
export class ApiLogQueryDto {
  // 基础过滤
  @ApiPropertyOptional({ description: "Filter by endpoint pattern" })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional({ description: "Filter by HTTP method" })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ description: "Filter by status code" })
  @IsOptional()
  statusCode?: number;

  @ApiPropertyOptional({ description: "Filter by user ID" })
  @IsOptional()
  @IsString()
  userId?: string;

  // 时间范围过滤
  @ApiPropertyOptional({ description: "Start date (ISO string)" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "End date (ISO string)" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  // 性能过滤
  @ApiPropertyOptional({ description: "Minimum duration (ms)" })
  @IsOptional()
  minDuration?: number;

  @ApiPropertyOptional({ description: "Maximum duration (ms)" })
  @IsOptional()
  maxDuration?: number;

  // 搜索功能
  @ApiPropertyOptional({ description: "Search in endpoint, error message" })
  @IsOptional()
  @IsString()
  search?: string;

  // 分页和排序
  @ApiPropertyOptional({ description: "Page number", example: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: "Items per page", example: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ 
    description: "Sort field",
    enum: ["createdAt", "duration", "statusCode", "endpoint"]
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: "Sort order",
    enum: ["asc", "desc"]
  })
  @IsOptional()
  @IsString()
  sortOrder?: string;

  // 高级选项
  @ApiPropertyOptional({ description: "Include request/response bodies" })
  @IsOptional()
  includeDetails?: boolean;

  @ApiPropertyOptional({ description: "Only show errors (4xx, 5xx)" })
  @IsOptional()
  errorsOnly?: boolean;
}
```

### 3. 核心查询方法设计

**基于GlobalQueriesService.getPrescriptions()的成功模式**:

```typescript
// src/common/services/api-log-query.service.ts
@Injectable()
export class ApiLogQueryService {
  private readonly logger = new Logger(ApiLogQueryService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 主查询方法 - 基于GlobalQueriesService.getPrescriptions()模式
   */
  async getApiLogs(query: ApiLogQueryDto) {
    const {
      endpoint,
      method,
      statusCode,
      userId,
      dateFrom,
      dateTo,
      minDuration,
      maxDuration,
      search,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
      includeDetails = false,
      errorsOnly = false,
    } = query;

    const skip = (page - 1) * limit;

    // 构建where条件 - 复用GlobalQueriesService模式
    const where: Prisma.ApiCallLogWhereInput = {};

    if (endpoint) {
      where.endpoint = { contains: endpoint, mode: "insensitive" };
    }

    if (method) {
      where.method = method.toUpperCase();
    }

    if (statusCode) {
      where.statusCode = statusCode;
    }

    if (userId) {
      where.userId = userId;
    }

    if (errorsOnly) {
      where.statusCode = { gte: 400 };
    }

    // 时间范围过滤
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // 性能过滤
    if (minDuration || maxDuration) {
      where.duration = {};
      if (minDuration) {
        where.duration.gte = minDuration;
      }
      if (maxDuration) {
        where.duration.lte = maxDuration;
      }
    }

    // 搜索功能
    if (search) {
      where.OR = [
        { endpoint: { contains: search, mode: "insensitive" } },
        { errorMessage: { contains: search, mode: "insensitive" } },
        { userAgent: { contains: search, mode: "insensitive" } },
      ];
    }

    // 动态排序 - 复用GlobalQueriesService模式
    let orderBy: any;
    switch (sortBy) {
      case "duration":
        orderBy = { duration: sortOrder };
        break;
      case "statusCode":
        orderBy = { statusCode: sortOrder };
        break;
      case "endpoint":
        orderBy = { endpoint: sortOrder };
        break;
      default:
        orderBy = { createdAt: sortOrder };
    }

    // 执行查询
    const [logs, total] = await Promise.all([
      this.prisma.apiCallLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: includeDetails ? {
            select: {
              id: true,
              email: true,
              role: true,
            },
          } : false,
        },
        orderBy,
      }),
      this.prisma.apiCallLog.count({ where }),
    ]);

    // 格式化响应 - 基于GlobalQueriesService模式
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      endpoint: log.endpoint,
      method: log.method,
      statusCode: log.statusCode,
      duration: log.duration,
      userId: log.userId,
      userAgent: log.userAgent,
      ip: log.ip,
      requestSize: log.requestSize,
      responseSize: log.responseSize,
      errorMessage: log.errorMessage,
      createdAt: log.createdAt,
      user: log.user || null,
      // 详细信息仅在请求时包含
      ...(includeDetails && {
        requestHeaders: log.requestHeaders,
        queryParams: log.queryParams,
        requestBody: log.requestBody,
        responseBody: log.responseBody,
        metadata: log.metadata,
      }),
    }));

    // 计算统计信息
    const statistics = await this.calculateStatistics(where);

    return {
      data: formattedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: statistics,
      filters: {
        endpoint,
        method,
        statusCode,
        userId,
        dateFrom,
        dateTo,
        minDuration,
        maxDuration,
        search,
        sortBy,
        sortOrder,
        errorsOnly,
      },
    };
  }

  /**
   * 统计计算方法 - 基于GlobalQueriesService模式
   */
  private async calculateStatistics(where: Prisma.ApiCallLogWhereInput) {
    const [
      statusCodeStats,
      endpointStats,
      performanceStats,
    ] = await Promise.all([
      // 状态码分布
      this.prisma.apiCallLog.groupBy({
        by: ["statusCode"],
        where,
        _count: { statusCode: true },
        _avg: { duration: true },
      }),
      // 热门端点
      this.prisma.apiCallLog.groupBy({
        by: ["endpoint"],
        where,
        _count: { endpoint: true },
        _avg: { duration: true },
        orderBy: { _count: { endpoint: "desc" } },
        take: 10,
      }),
      // 性能统计
      this.prisma.apiCallLog.aggregate({
        where,
        _avg: { duration: true },
        _min: { duration: true },
        _max: { duration: true },
        _count: { id: true },
      }),
    ]);

    return {
      statusCodeBreakdown: statusCodeStats.reduce((acc, item) => {
        acc[item.statusCode] = {
          count: item._count.statusCode,
          avgDuration: Math.round(item._avg.duration || 0),
        };
        return acc;
      }, {}),
      topEndpoints: endpointStats.map(item => ({
        endpoint: item.endpoint,
        count: item._count.endpoint,
        avgDuration: Math.round(item._avg.duration || 0),
      })),
      performance: {
        totalRequests: performanceStats._count.id,
        avgDuration: Math.round(performanceStats._avg.duration || 0),
        minDuration: performanceStats._min.duration || 0,
        maxDuration: performanceStats._max.duration || 0,
      },
    };
  }

  /**
   * 获取实时统计 - 最近1小时
   */
  async getRealtimeStats() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const [
      totalRequests,
      errorRequests,
      avgDuration,
      slowRequests,
    ] = await Promise.all([
      this.prisma.apiCallLog.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),
      this.prisma.apiCallLog.count({
        where: { 
          createdAt: { gte: oneHourAgo },
          statusCode: { gte: 400 },
        },
      }),
      this.prisma.apiCallLog.aggregate({
        where: { createdAt: { gte: oneHourAgo } },
        _avg: { duration: true },
      }),
      this.prisma.apiCallLog.count({
        where: { 
          createdAt: { gte: oneHourAgo },
          duration: { gte: 1000 }, // >1s
        },
      }),
    ]);

    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

    return {
      timeWindow: "last_hour",
      totalRequests,
      errorRequests,
      errorRate: Math.round(errorRate * 100) / 100,
      avgDuration: Math.round(avgDuration._avg.duration || 0),
      slowRequests,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 获取用户活动统计
   */
  async getUserActivityStats(timeWindow = "24h") {
    const timeAgo = this.getTimeAgo(timeWindow);
    
    const userStats = await this.prisma.apiCallLog.groupBy({
      by: ["userId"],
      where: { 
        createdAt: { gte: timeAgo },
        userId: { not: null },
      },
      _count: { userId: true },
      _avg: { duration: true },
      orderBy: { _count: { userId: "desc" } },
      take: 20,
    });

    return userStats.map(stat => ({
      userId: stat.userId,
      requestCount: stat._count.userId,
      avgDuration: Math.round(stat._avg.duration || 0),
    }));
  }

  /**
   * 导出功能 - 支持CSV和JSON
   */
  async exportLogs(query: ApiLogQueryDto, format: "csv" | "json" = "json") {
    // 移除分页限制进行导出
    const exportQuery = { ...query, page: 1, limit: 10000 };
    const result = await this.getApiLogs(exportQuery);
    
    if (format === "csv") {
      return this.convertToCSV(result.data);
    }
    
    return result;
  }

  private getTimeAgo(timeWindow: string): Date {
    const now = Date.now();
    switch (timeWindow) {
      case "1h": return new Date(now - 60 * 60 * 1000);
      case "24h": return new Date(now - 24 * 60 * 60 * 1000);
      case "7d": return new Date(now - 7 * 24 * 60 * 60 * 1000);
      case "30d": return new Date(now - 30 * 24 * 60 * 60 * 1000);
      default: return new Date(now - 24 * 60 * 60 * 1000);
    }
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return "";
    
    const headers = Object.keys(data[0]).filter(key => 
      !["requestHeaders", "queryParams", "requestBody", "responseBody", "metadata"].includes(key)
    );
    
    const csvRows = [
      headers.join(","),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : value;
        }).join(",")
      ),
    ];
    
    return csvRows.join("\n");
  }
}
```

---

## 🚀 详细技术实施计划

### 📋 TODOS - ApiLogQueryService开发指导

#### ✅ TODO 1: 创建DTO文件 (预计30分钟)
**文件**: `src/common/dto/api-log-query.dto.ts`
**具体动作**:
```typescript
// 1.1 创建基础DTO类
export class ApiLogQueryDto {
  // 复制GlobalPrescriptionsQueryDto的验证装饰器模式
  @ApiPropertyOptional({ description: "Filter by endpoint pattern" })
  @IsOptional()
  @IsString()
  endpoint?: string;
  // ... 其他字段
}

// 1.2 创建统计查询DTO
export class ApiLogStatsQueryDto {
  @ApiPropertyOptional({ description: "Time window for stats" })
  @IsOptional()
  @IsIn(["1h", "24h", "7d", "30d"])
  timeWindow?: string;
}

// 1.3 创建导出DTO
export class ApiLogExportDto extends ApiLogQueryDto {
  @ApiPropertyOptional({ description: "Export format" })
  @IsOptional()
  @IsIn(["csv", "json"])
  format?: "csv" | "json";
}
```
**验证标准**: 
- [ ] 所有字段包含适当的验证装饰器
- [ ] API文档注解完整
- [ ] 与GlobalPrescriptionsQueryDto保持一致的模式

#### ✅ TODO 2: 实现核心查询服务 (预计90分钟)
**文件**: `src/common/services/api-log-query.service.ts`
**具体动作**:
```typescript
// 2.1 创建服务基础结构 (15分钟)
@Injectable()
export class ApiLogQueryService {
  private readonly logger = new Logger(ApiLogQueryService.name);
  constructor(private prisma: PrismaService) {}
}

// 2.2 实现主查询方法 (45分钟)
async getApiLogs(query: ApiLogQueryDto) {
  // 复制GlobalQueriesService.getPrescriptions()的完整结构
  const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = query;
  const skip = (page - 1) * limit;
  
  // 构建where条件 - 精确复制GlobalQueriesService模式
  const where: Prisma.ApiCallLogWhereInput = {};
  // ... 实现所有过滤条件
  
  // 执行查询
  const [logs, total] = await Promise.all([
    this.prisma.apiCallLog.findMany({ where, skip, take: limit, orderBy }),
    this.prisma.apiCallLog.count({ where })
  ]);
  
  return { data: formattedLogs, pagination, summary, filters };
}

// 2.3 实现统计计算方法 (30分钟)
private async calculateStatistics(where: Prisma.ApiCallLogWhereInput) {
  // 状态码分布、热门端点、性能统计
}
```
**验证标准**:
- [ ] 查询方法返回格式与GlobalQueriesService一致
- [ ] 所有过滤条件正确实现
- [ ] 分页和排序功能正常
- [ ] 错误处理完整

#### ✅ TODO 3: 实现高级查询方法 (预计60分钟)
**具体动作**:
```typescript
// 3.1 实时统计方法 (20分钟)
async getRealtimeStats() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  // 实现最近1小时的统计
}

// 3.2 用户活动统计 (20分钟)
async getUserActivityStats(timeWindow = "24h") {
  // 按用户分组的活动统计
}

// 3.3 导出功能 (20分钟)
async exportLogs(query: ApiLogQueryDto, format: "csv" | "json") {
  // CSV转换和JSON导出
}
```
**验证标准**:
- [ ] 实时统计数据准确
- [ ] 用户活动统计正确分组
- [ ] CSV导出格式正确
- [ ] JSON导出包含完整数据

#### ✅ TODO 4: 集成到CommonModule (预计15分钟)
**文件**: `src/common/common.module.ts`
**具体动作**:
```typescript
// 4.1 添加服务提供者
@Module({
  providers: [
    // 现有服务...
    ApiLoggingService,
    ApiLogQueryService, // 新增
    RealtimePerformanceMonitorService,
  ],
  exports: [
    // 现有导出...
    ApiLoggingService,
    ApiLogQueryService, // 新增
    RealtimePerformanceMonitorService,
  ],
})
export class CommonModule {}
```
**验证标准**:
- [ ] 服务正确注册到providers
- [ ] 服务正确添加到exports
- [ ] 模块编译无错误

#### ✅ TODO 5: 创建单元测试 (预计45分钟)
**文件**: `src/common/__tests__/api-log-query.service.spec.ts`
**具体动作**:
```typescript
// 5.1 测试基础结构 (15分钟)
describe('ApiLogQueryService', () => {
  let service: ApiLogQueryService;
  let prisma: PrismaService;
  
  beforeEach(async () => {
    // 设置测试模块
  });
});

// 5.2 核心查询测试 (20分钟)
describe('getApiLogs', () => {
  it('should return paginated results with correct format');
  it('should filter by endpoint correctly');
  it('should filter by date range correctly');
  it('should sort by different fields correctly');
});

// 5.3 统计功能测试 (10分钟)
describe('statistics', () => {
  it('should calculate realtime stats correctly');
  it('should calculate user activity stats correctly');
});
```
**验证标准**:
- [ ] 所有核心方法有对应测试
- [ ] 测试覆盖率 > 80%
- [ ] Mock数据设置正确
- [ ] 边界条件测试完整

#### ✅ TODO 6: 性能优化验证 (预计30分钟)
**具体动作**:
```typescript
// 6.1 查询性能测试
async function testQueryPerformance() {
  const startTime = Date.now();
  await apiLogQueryService.getApiLogs({
    page: 1,
    limit: 100,
    dateFrom: "2025-01-01",
    dateTo: "2025-12-31"
  });
  const duration = Date.now() - startTime;
  console.log(`Query duration: ${duration}ms`);
}

// 6.2 索引使用验证
// 检查EXPLAIN ANALYZE输出确认索引使用
```
**验证标准**:
- [ ] 基础查询 < 200ms
- [ ] 复杂查询 < 500ms
- [ ] 索引正确使用
- [ ] 内存使用合理

#### ✅ TODO 7: 集成测试 (预计30分钟)
**文件**: `src/common/__tests__/api-log-query.integration.spec.ts`
**具体动作**:
```typescript
// 7.1 端到端集成测试
describe('ApiLogQuery Integration', () => {
  it('should work with real ApiLoggingService data');
  it('should handle large dataset queries');
  it('should export data correctly');
});

// 7.2 与现有服务集成测试
describe('Service Integration', () => {
  it('should integrate with ApiLoggingService');
  it('should work with PerformanceDashboardController');
});
```
**验证标准**:
- [ ] 与ApiLoggingService数据兼容
- [ ] 大数据集查询稳定
- [ ] 导出功能正常
- [ ] 无内存泄漏

### 📊 开发进度跟踪

**当前状态**: 准备开始实施
**预计总时间**: 5-6小时
**关键里程碑**:
- [ ] TODO 1-2完成: 核心查询功能可用 (2小时)
- [ ] TODO 3-4完成: 高级功能集成 (3.5小时)
- [ ] TODO 5-7完成: 测试和优化完成 (5-6小时)

### 🔄 执行顺序建议

**立即执行**: TODO 1 (创建DTO) → TODO 2 (核心查询)
**验证点**: 每完成一个TODO立即测试验证
**回滚策略**: 每个TODO完成后提交代码，便于回滚

---

## 📊 技术优势

### 1. 基于成功模式
- **复用GlobalQueriesService**: 经过验证的查询模式
- **一致的API设计**: 与现有admin查询接口保持一致
- **标准化响应格式**: 统一的分页和统计结构

### 2. 性能优化
- **索引利用**: 充分利用现有的6个复合索引
- **分页查询**: 避免大数据量内存问题
- **选择性加载**: includeDetails控制详细信息加载

### 3. 功能完整
- **全面过滤**: 时间、性能、状态码、用户等多维度
- **灵活排序**: 支持多字段动态排序
- **实时统计**: 支持实时监控需求
- **导出功能**: 支持数据分析需求

---

## 🔄 下一步执行

**立即开始**: 创建DTO和核心查询服务  
**预计时间**: 2-3小时完成核心功能  
**验证方式**: 集成现有ApiLoggingService进行端到端测试

这个方案基于.claude/全局规范和现有代码库的最佳实践，确保了一致性和可维护性。