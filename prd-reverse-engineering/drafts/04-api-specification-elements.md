# PRD逆向工程技术要素文档 - API规范要素

## 1. NestJS装饰器驱动API架构技术实现

### 1.1 控制器层装饰器技术栈集成
**核心装饰器组合技术实现**：
- @Controller装饰器实现路由前缀定义和模块化API组织
- @ApiTags装饰器实现Swagger文档自动分类和端点组织
- @Version装饰器实现URI版本控制和向后兼容性管理
- @UseGuards装饰器实现认证授权的声明式权限控制集成

**API端点装饰器技术标准**：
- @Get/@Post/@Put/@Patch/@Delete装饰器映射HTTP动词和业务操作语义
- @ApiOperation装饰器实现操作描述和Swagger文档自动生成
- @ApiResponse装饰器实现响应类型定义和状态码文档化
- @Body/@Query/@Param装饰器实现请求参数自动验证和类型转换

**权限控制装饰器集成技术**：
- @Auth装饰器实现JWT令牌验证和用户上下文自动注入
- @AuthRoles装饰器实现基于角色的端点访问控制
- @RequirePermissions装饰器实现细粒度权限验证集成
- @AdminOrOwner装饰器实现复合权限条件的动态验证

### 1.2 依赖注入服务层技术架构
**服务注入模式技术实现**：
- @Injectable装饰器实现服务类的依赖注入容器注册
- constructor参数注入实现PrismaService数据库访问层自动注入
- @Inject装饰器实现配置服务和第三方服务的依赖注入
- 单例模式确保数据库连接池和缓存服务的全局共享

**模块化依赖组织技术**：
- @Module装饰器实现providers、controllers、imports的模块化组织
- forRoot/forRootAsync模式实现配置驱动的模块初始化
- 循环依赖通过forwardRef()解决和ModuleRef动态注入
- 全局模块@Global装饰器实现跨模块服务共享

### 1.3 中间件管道技术集成
**全局中间件技术栈配置**：
- validationPipeConfig实现whitelist:true和forbidNonWhitelisted:true参数验证
- HttpExceptionFilter实现统一异常处理和错误响应格式标准化
- PerformanceMonitoringMiddleware实现API响应时间监控和警告阈值控制
- LoggerMiddleware实现请求日志记录和ApiCallLog数据库持久化

**请求处理管道技术顺序**：
- Guards执行阶段：JWT认证验证和用户角色权限检查
- Interceptors执行阶段：请求前预处理和响应后数据转换
- Pipes执行阶段：参数验证、类型转换和DTO对象构造
- ExceptionFilters执行阶段：异常捕获、错误格式化和安全信息过滤

## 2. 统一响应格式技术标准化实现

### 2.1 ApiResponseV12Dto技术架构
**响应信封模式技术实现**：
- success字段类型boolean实现操作结果的明确二值判断
- data字段泛型T支持任意复杂业务数据结构的类型安全封装
- error对象包含code、message、details、timestamp的结构化错误信息
- meta对象包含timestamp和pagination的元数据信息标准化

**分页响应技术实现机制**：
- MedicinePaginationMetaDto实现total、page、limit、totalPages分页状态信息
- 基于Prisma的count()和skip()/take()实现高效分页查询
- totalPages自动计算：Math.ceil(total / limit)确保分页计算准确性
- 分页参数验证：page≥1、limit在1-100范围内的边界条件控制

**时间戳标准化技术处理**：
- new Date().toISOString()生成UTC时间戳确保跨时区一致性
- meta.timestamp记录响应生成时间支持客户端缓存和调试
- 数据库createdAt/updatedAt字段使用@default(now())自动时间戳
- 毫秒精度时间戳支持高频操作的时序排序和审计需求

### 2.2 DTO验证技术机制
**class-validator装饰器技术集成**：
- @IsNotEmpty()、@IsString()、@IsNumber()实现基础类型验证
- @Min()、@Max()、@IsEnum()实现业务规则验证和枚举值控制
- @ValidateNested()、@Type()实现嵌套对象验证和类型转换
- @Transform()实现自定义转换逻辑和数据清理规则

**ValidationPipe技术配置参数**：
- whitelist:true自动移除未定义属性防止参数污染攻击
- forbidNonWhitelisted:true主动拒绝包含非白名单属性的请求
- transform:true实现字符串到数值、布尔值的自动类型转换
- transformOptions.enableImplicitConversion支持深层对象的类型推断

**错误响应技术标准化**：
- exceptionFactory自定义验证错误的响应格式和错误信息结构
- 字段级错误定位通过property和constraints提供精确错误位置
- 多字段验证错误聚合到errors数组实现批量错误信息返回
- 国际化错误消息通过Accept-Language头部和错误码映射实现

### 2.3 响应转换技术实现
**transformToResponseV12技术函数**：
- 泛型函数实现任意数据类型到ApiResponseV12Dto的转换
- success字段根据操作结果自动设置true/false状态值
- data字段直接传递业务数据保持原始数据结构完整性
- meta字段自动注入timestamp和分页信息实现元数据标准化

**序列化技术优化策略**：
- @Exclude()装饰器实现敏感字段的响应过滤和隐私保护
- @Transform()装饰器实现数据脱敏和格式化输出控制
- classToPlain()转换确保循环引用安全和序列化性能优化
- 深度限制控制避免无限递归和堆栈溢出风险

## 3. JWT认证授权技术架构实现

### 3.1 PassportJS集成技术策略
**JwtStrategy技术实现机制**：
- ExtractJwt.fromAuthHeaderAsBearerToken()实现Authorization头部令牌提取
- secretOrKey从ConfigService获取确保密钥安全存储和环境隔离
- ignoreExpiration:false强制令牌过期验证确保安全性
- validate方法实现用户信息查询和角色权限数据预加载

**令牌生命周期技术管理**：
- expiresIn:'7d'设置访问令牌7天有效期平衡安全性和用户体验
- refreshToken使用32字节随机数生成和bcrypt哈希存储确保安全性
- 令牌轮换机制：刷新令牌使用后立即标记为已使用防止重放攻击
- 令牌撤销通过数据库状态字段实现和黑名单缓存机制

**认证状态技术缓存**：
- 用户权限信息在JWT payload中缓存减少数据库查询
- role、permissions、clinicId等关键信息JWT声明中包含
- 权限变更通过令牌强制刷新实现即时权限更新
- 分布式部署环境下的权限同步通过共享数据库状态实现

### 3.2 RBAC权限模型技术实现
**角色权限技术映射**：
- PRACTITIONER角色映射医师权限集合和诊所数据访问边界
- PHARMACY_OPERATOR角色映射药房操作权限和关联药房数据范围
- ADMIN角色映射管理员权限和跨组织数据访问能力
- 权限继承通过数据库角色层次表实现和动态权限扩展支持

**资源访问边界技术控制**：
- doctorId字段过滤确保医师只能访问自己创建的处方数据
- operatorId关联查询确保药房操作员只能访问所属药房数据
- 管理员权限通过role==='admin'判断实现全局数据访问能力
- 数据查询自动注入WHERE条件实现透明的数据访问边界控制

**权限验证技术优化**：
- @SetMetadata装饰器实现权限要求的元数据标注
- Reflector服务获取控制器和方法级权限要求元数据
- canActivate方法实现运行时权限决策和访问控制逻辑
- 权限决策结果缓存减少重复权限检查的性能开销

### 3.3 安全防护技术机制
**令牌传输安全技术**：
- Bearer Token标准实现Authorization: Bearer <token>格式传输
- HTTPS强制传输通过Strict-Transport-Security头部和TLS配置
- 令牌在客户端localStorage存储和XSS防护建议
- 跨域令牌传输通过CORS credentials:true配置和预检请求处理

**认证异常技术处理**：
- JWT过期异常返回401状态码和令牌刷新指导信息
- 无效令牌异常返回401状态码和重新登录引导信息
- 权限不足异常返回403状态码和权限申请联系信息
- 认证失败日志记录和异常访问行为监控告警

## 4. API版本控制技术管理策略

### 4.1 URI版本控制技术实现
**NestJS版本控制技术配置**：
- VersioningType.URI实现/api/v1/前缀版本控制策略
- defaultVersion:"1"设置默认版本避免无版本请求的处理歧义
- prefix:"v"配置版本前缀格式和URL路径结构标准化
- 版本路由自动解析和端点版本映射的框架级支持

**API文档版本管理技术策略**：
- docs/api/UNIFIED_API_DOCUMENTATION_v1.md作为v1版本唯一权威文档
- docs/api/API_CHANGELOG_v1.md记录v1版本所有变更历史和时间线
- 版本升级时创建新文档docs/api/UNIFIED_API_DOCUMENTATION_v2.md替代v1文档
- 旧版本文档移动到docs/api/archived/目录保持历史记录完整性

**版本兼容性技术保证**：
- 向后兼容变更不增加主版本号确保客户端无缝升级
- 破坏性变更必须增加主版本号和新版本端点并行提供
- 版本弃用通过Sunset头部提供弃用时间表和迁移指导
- 版本切换通过Accept头部Version字段实现临时版本覆盖

### 4.2 Swagger文档技术自动化
**OpenAPI规范技术生成**：
- DocumentBuilder配置标题、描述、版本和服务器地址信息
- addBearerAuth配置JWT认证和Bearer Token格式文档化
- addApiKey配置idempotency-key头部和幂等性操作支持
- SwaggerModule.setup实现/api/docs路径的交互式文档访问

**文档更新技术流程**：
- 代码变更后npm run build自动重新生成OpenAPI JSON规范
- Swagger装饰器变更自动同步到/api/docs交互式文档界面
- 文档一致性检查脚本验证API实现与文档的同步性
- CI/CD流程集成文档构建和部署确保文档实时性

**文档访问技术控制**：
- 开发环境/api/docs完全开放支持API测试和调试
- 生产环境通过IP白名单或认证限制文档访问权限
- 文档中敏感信息自动过滤和内部实现细节隐藏
- API使用统计和文档访问日志记录支持使用分析

## 5. 性能监控技术实现架构

### 5.1 PerformanceMonitoringMiddleware技术实现
**响应时间监控技术机制**：
- performance.now()高精度时间测量实现毫秒级响应时间统计
- 警告阈值300ms和严重阈值1000ms的响应时间分级告警
- console.warn和console.error实现响应时间超限的实时日志告警
- ApiCallLog数据库表持久化存储响应时间历史数据和趋势分析

**性能指标技术收集**：
- duration字段记录API端点响应时间支持性能基准分析
- requestSize和responseSize字段记录请求响应数据大小
- endpoint和method字段记录API路径和HTTP方法统计
- statusCode字段记录响应状态码分布和错误率统计

### 5.2 数据库查询性能技术优化
**Prisma索引策略技术实现**：
- User表role字段索引支持角色过滤查询性能优化
- Prescription表doctorId+status复合索引支持医师处方列表高效查询
- createdAt(sort:Desc)索引支持时间序列排序查询优化
- ApiCallLog表userId+createdAt复合索引支持用户行为分析查询

**查询优化技术策略**：
- select字段限制减少不必要数据传输和序列化开销
- include关联查询替代多次单独查询避免N+1问题
- take和skip参数实现高效分页避免大数据集全量查询
- count()查询与数据查询分离减少总数统计的性能影响

### 5.3 缓存策略技术实现
**内存缓存技术应用**：
- @nestjs/cache-manager集成Redis缓存和TTL过期策略
- 药品搜索结果缓存60秒减少数据库查询频率
- 用户权限信息缓存300秒减少认证查询开销
- 配置信息缓存3600秒减少系统配置查询

**缓存失效技术机制**：
- 数据变更后相关缓存键自动失效确保数据一致性
- 缓存键命名规范user:${id}:permissions确保缓存精确定位
- 缓存预热在系统启动时预加载热点数据提升响应速度
- 缓存雪崩防护通过随机TTL避免大量缓存同时失效

## 6. 药房价格表管理API技术架构实现

### 6.1 药房价格表CRUD API设计
**价格表管理端点技术实现**：
- POST /api/v1/pharmacy/price-lists 药房上传新价格表
- GET /api/v1/pharmacy/price-lists 查询药房价格表历史版本
- PUT /api/v1/pharmacy/price-lists/{version} 更新指定版本价格表
- GET /api/v1/pharmacy/price-lists/current 获取当前生效价格表

**价格表数据结构技术标准**：
- PriceListUploadDto包含medicines数组、effectiveDate生效日期、notes备注
- 单个药品价格项：medicineId、customPrice、basePrice参考价、margin利润率
- 价格表版本控制：version递增序号、status审核状态、createdAt时间戳
- 文件上传支持：Excel/CSV格式批量价格表上传和解析验证

**药房权限控制技术机制**：
- @AuthRoles('pharmacy_operator')确保仅药房操作员访问
- 药房ID自动注入：从JWT token提取operatorId关联pharmacyId
- 数据访问边界：药房仅能管理自己的价格表，无法访问其他药房数据
- 操作审计：记录价格表变更操作员和时间戳到ApiCallLog

### 6.2 管理员价格表审核API技术架构
**管理员审核端点技术实现**：
- GET /api/v1/admin/price-lists/pending 获取待审核价格表列表
- GET /api/v1/admin/price-lists/{id}/review 获取价格表详细审核信息
- POST /api/v1/admin/price-lists/{id}/approve 批准价格表生效
- POST /api/v1/admin/price-lists/{id}/reject 拒绝价格表并提供原因

**价格合规性检查技术机制**：
- basePrice约束验证：自动检查药房价格不得超过对应药品basePrice
- 价格告警计算：计算超限药品数量、超限金额、平均超限比例
- 风险等级评估：根据超限情况自动分类为低/中/高风险价格表
- 告警信息结构：violationCount、affectedMedicines、riskLevel、recommendations

**管理员审核界面数据技术支持**：
- 价格对比视图：并排显示药房价格vs basePrice，超限项高亮显示
- 审核决策辅助：提供历史审核记录、药房合规率、价格趋势分析
- 批量审核支持：多价格表批量审核和批量操作接口
- 审核日志完整性：记录审核决策、原因、时间戳到专用审核日志表

### 6.3 价格表生效和通知API技术流程
**价格表生效机制技术实现**：
- 自动生效：管理员批准后价格表状态更新为approved，按effectiveDate生效
- 版本控制：新版本生效时自动将旧版本标记为inactive
- 缓存更新：价格表生效后自动清除相关缓存，确保查询数据一致性
- 事件通知：发布PriceListApproved事件触发下游业务逻辑更新

**药房通知机制技术架构**：
- 邮件通知：价格表审核结果自动邮件通知到药房注册邮箱
- 系统内通知：WebSocket实时推送审核结果到药房操作员界面
- 通知内容差量化：审核通过仅通知生效时间，拒绝时提供详细原因和修改建议
- 隐私保护：通知内容不包含basePrice约束违规的具体告警信息

## 7. 错误处理技术标准化实现

### 7.1 HttpExceptionFilter技术架构
**全局异常处理技术机制**：
- @Catch()装饰器实现所有异常类型的统一捕获和处理
- HttpException子类自动识别和标准HTTP状态码映射
- Prisma异常转换为业务友好错误信息和状态码
- 未知异常安全处理避免系统内部信息泄露

**错误响应技术格式**：
- statusCode、timestamp、path、method标准错误上下文信息
- message用户友好错误描述和error技术错误类型标识
- 生产环境500错误信息自动替换为"Internal server error"
- 开发环境完整错误堆栈和调试信息保留

**错误日志技术记录**：
- Logger服务结构化日志记录和错误级别分类
- 错误堆栈和请求上下文完整记录支持问题排查
- 敏感信息自动过滤避免密码和令牌信息泄露
- 日志聚合和ELK集成支持分布式环境错误监控

### 7.2 业务异常技术处理

**药房价格表异常技术处理**：
- PriceListValidationException：价格表格式验证失败异常
- BasePrice ViolationException：价格超限异常，仅对管理员可见
- PriceListConflictException：价格表版本冲突异常
- PharmacyAccessDeniedException：跨药房数据访问异常

### 7.3 业务异常技术处理扩展
**自定义异常技术实现**：
- BusinessException继承HttpException实现业务错误标准化
- 错误代码常量定义ERROR_CODES确保错误分类一致性
- 异常构造函数接受错误代码和消息参数支持灵活错误创建
- 异常链传递保持原始错误信息和调用栈完整性

**验证异常技术处理**：
- ValidationPipe异常格式化为字段级错误信息数组
- 错误消息国际化通过错误代码和语言偏好映射实现
- 嵌套对象验证错误的属性路径精确定位
- 批量验证错误聚合和客户端友好格式转换

## 8. CORS跨域技术配置实现

### 8.1 开发环境CORS技术策略
**允许源域技术配置**：
- localhost:3000-3009端口范围支持多前端应用开发环境
- 127.0.0.1和0.0.0.0地址支持本地开发和容器环境
- 动态CORS配置支持环境变量ALLOWED_ORIGINS数组配置
- 开发环境宽松CORS策略提升开发效率和调试便利性

**HTTP方法技术限制**：
- GET、POST、PUT、PATCH、DELETE、OPTIONS标准RESTful方法支持
- 自定义HTTP方法禁止确保API接口规范性和安全性
- preflight请求自动处理和OPTIONS方法响应优化
- 方法白名单验证和非法方法请求拒绝机制

### 8.2 请求头部技术控制
**允许头部技术配置**：
- Content-Type、Authorization标准HTTP头部支持
- idempotency-key自定义头部支持幂等性操作实现
- X-Requested-With、Accept、Origin跨域请求必需头部
- 敏感头部过滤和安全头部白名单验证机制

**凭证传输技术支持**：
- credentials:true配置支持Cookie和认证信息跨域传输
- CORS预检缓存Access-Control-Max-Age优化重复预检性能
- 动态CORS策略基于请求来源的安全验证和访问控制
- 生产环境严格CORS配置和安全域名白名单验证

## 9. MVP API规范技术要素实施标准

### 9.1 API技术实现成熟度评估
**当前技术栈完成度分析**：
- NestJS装饰器架构：95%完成度，控制器、服务、模块化组织完整
- JWT认证授权：90%完成度，PassportJS集成和RBAC权限控制完善
- 统一响应格式：100%完成度，ApiResponseV12Dto标准化和验证机制完备
- 药房价格表管理：85%完成度，CRUD端点设计完整，需要补充审核流程集成
- 性能监控系统：80%完成度，基础监控和数据库索引优化，缺乏高级APM集成
- 错误处理标准：90%完成度，全局异常过滤和业务异常处理，包含价格表专项异常
- API文档化：90%完成度，Swagger集成和交互式文档，需要完善版本管理

### 9.2 药房价格表API技术验收标准
**价格表管理API性能要求**：
- 价格表上传端点响应时间P95 < 2000ms（支持大文件处理）
- 价格表查询端点响应时间P95 < 300ms确保用户体验
- 管理员审核页面响应时间P95 < 500ms支持高效审核
- 价格合规检查算法执行时间 < 100ms确保实时反馈

**价格表业务逻辑验收标准**：
- basePrice约束验证100%覆盖所有药品价格项
- 价格表版本控制支持完整的创建->审核->生效->归档生命周期
- 管理员审核界面必须包含价格违规高亮和风险等级评估
- 药房通知机制必须屏蔽basePrice相关的内部告警信息

**数据安全和权限验证标准**：
- 药房操作员仅能访问自己关联药房的价格表数据
- 跨药房数据访问尝试必须触发PharmacyAccessDeniedException
- 管理员审核操作必须记录完整审计日志到专用审核表
- 价格表敏感信息（basePrice对比）仅对管理员角色可见

### 9.3 新项目API技术基准要求
**技术栈配置标准**：
- NestJS 11.x框架和TypeScript 5.x严格类型检查
- Prisma 6.x ORM和PostgreSQL 14+数据库支持
- @nestjs/swagger 11.x和OpenAPI 3.0规范集成
- @nestjs/jwt 11.x和passport-jwt 4.x认证体系
- class-validator 0.14.x和class-transformer 0.5.x验证转换

**API实施技术要求**：
- 所有控制器必须使用装饰器驱动的路由和文档定义
- 统一ApiResponseV12Dto响应格式和分页元数据标准
- JWT认证和RBAC权限控制的完整集成实现
- PerformanceMonitoringMiddleware和响应时间监控部署
- HttpExceptionFilter全局异常处理和错误格式标准化

### API技术验收标准
**性能指标技术要求**：
- 认证端点响应时间P95 < 300ms确保用户体验
- 分页查询端点响应时间P95 < 500ms支持数据浏览
- 数据库查询索引覆盖率100%确保查询性能
- API文档覆盖率100%确保所有端点有完整文档

**安全技术验收标准**：
- JWT令牌7天有效期和刷新令牌轮换机制部署
- RBAC权限验证覆盖所有敏感操作端点
- CORS配置和安全头部设置符合生产环境要求
- 输入验证和SQL注入防护通过安全扫描验证