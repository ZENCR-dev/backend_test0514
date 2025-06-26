import { Controller, Get, Post, Delete, HttpStatus, Logger, Query, Param, Body, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrchestrationService } from '../services/orchestration.service';
import { OrchestrationGateway } from '../gateways/orchestration.gateway';
import { EventPersistenceService } from '../services/event-persistence.service';
import { EventProcessingStatus } from '@prisma/client';
import { PAYMENT_EVENTS, ORDER_EVENTS } from '../../common/events/types';

/**
 * 健康检查响应接口
 */
interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    orchestration: {
      status: 'up' | 'down';
      details?: Record<string, any>;
    };
    websocket: {
      status: 'up' | 'down';
      connections: number;
      details?: Record<string, any>;
    };
  };
}

/**
 * 监控指标响应接口
 */
interface MetricsResponse {
  timestamp: string;
  orchestrationService: {
    status: 'healthy' | 'unhealthy';
    service?: string;
    timestamp: string;
    websocketMetrics: any;
  };
  websocketGateway: {
    activeConnections: number;
    totalConnectionAttempts: number;
    totalEvents: number;
    errorRate: number;
    roleDistribution?: Record<string, number>;
    clinicDistribution?: Record<string, number>;
    inactiveConnections?: number;
  };
}

/**
 * 增强监控仪表板响应接口
 */
interface DashboardResponse {
  timestamp: string;
  summary: {
    overallHealth: 'healthy' | 'unhealthy';
    totalConnections: number;
    totalEventsProcessed: number;
    averageResponseTime: number;
    errorRate: number;
  };
  orchestrationService: {
    eventProcessing: {
      totalEventsProcessed: number;
      averageProcessingTime: number;
      successRate: number;
      failureRate: number;
    };
    eventTypeDistribution: Record<string, number>;
    compensationMetrics: {
      totalCompensationsTriggered: number;
      compensationsByReason: Record<string, number>;
    };
    performanceAnalysis: {
      p50ProcessingTime: number;
      p95ProcessingTime: number;
      p99ProcessingTime: number;
      slowestEventType: string;
      fastestEventType: string;
    };
    healthMetrics: {
      isHealthy: boolean;
      uptime: number;
      lastErrorTime: number | null;
      errorCount: number;
    };
  };
  websocketGateway: {
    connectionMetrics: {
      averageConnectionDuration: number;
      totalConnectionTime: number;
      currentConnections: number;
      peakConnections: number;
    };
    messageMetrics: {
      totalMessagesSent: number;
      messagesPerSecond: number;
      messagesByEvent: Record<string, number>;
    };
    roomMetrics: {
      totalRooms: number;
      averageClientsPerRoom: number;
      largestRoom: number;
    };
    slidingWindowMetrics: {
      last1MinuteMessages: number;
      last5MinuteMessages: number;
      last1MinuteErrors: number;
    };
    errorMetrics: {
      connectionErrors: number;
      authenticationErrors: number;
      messageDeliveryFailures: number;
    };
    performanceMetrics: {
      p50Latency: number;
      p95Latency: number;
      p99Latency: number;
    };
  };
}

/**
 * 业务编排健康检查控制器
 * 
 * 提供健康检查和监控端点，用于系统监控和运维
 */
@ApiTags('健康检查')
@Controller('health/orchestration')
export class OrchestrationHealthController {
  private readonly logger = new Logger(OrchestrationHealthController.name);

  constructor(
    private readonly orchestrationService: OrchestrationService,
    private readonly orchestrationGateway: OrchestrationGateway,
    private readonly eventPersistenceService: EventPersistenceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 健康检查端点
   * 
   * 返回业务编排服务的健康状态
   */
  @Get()
  @ApiOperation({ summary: '业务编排服务健康检查' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '服务健康',
    schema: {
      example: {
        status: 'healthy',
        timestamp: '2023-05-14T12:34:56.789Z',
        services: {
          orchestration: { status: 'up' },
          websocket: { status: 'up', connections: 5 }
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.SERVICE_UNAVAILABLE, 
    description: '服务不健康',
    schema: {
      example: {
        status: 'unhealthy',
        timestamp: '2023-05-14T12:34:56.789Z',
        services: {
          orchestration: { status: 'down', details: { reason: 'Service not initialized' } },
          websocket: { status: 'down', connections: 0, details: { reason: 'Socket server not running' } }
        }
      }
    }
  })
  healthCheck(): HealthCheckResponse {
    this.logger.log('Health check requested');
    
    const orchestrationHealthy = this.orchestrationService.isHealthy();
    const websocketHealthy = this.orchestrationGateway.isHealthy();
    const overallStatus = orchestrationHealthy && websocketHealthy ? 'healthy' : 'unhealthy';
    
    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        orchestration: {
          status: orchestrationHealthy ? 'up' : 'down'
        },
        websocket: {
          status: websocketHealthy ? 'up' : 'down',
          connections: this.orchestrationGateway.getConnectionCount()
        }
      }
    };
    
    // 如果服务不健康，添加更多详情
    if (!orchestrationHealthy) {
      response.services.orchestration.details = { 
        reason: 'Service not properly initialized or internal error'
      };
    }
    
    if (!websocketHealthy) {
      response.services.websocket.details = { 
        reason: 'WebSocket server not running or internal error'
      };
    }
    
    // 设置适当的HTTP状态码
    const httpStatus = overallStatus === 'healthy' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    
    return response;
  }

  /**
   * 详细监控指标端点
   * 
   * 返回业务编排服务的详细监控指标
   */
  @Get('metrics')
  @ApiOperation({ summary: '业务编排服务监控指标' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '监控指标',
    schema: {
      example: {
        timestamp: '2023-05-14T12:34:56.789Z',
        orchestrationService: {
          status: 'healthy'
        },
        websocketGateway: {
          activeConnections: 5,
          totalConnectionAttempts: 10,
          totalEvents: 25,
          errorRate: 0.5,
          roleDistribution: {
            doctor: 2,
            patient: 3
          },
          clinicDistribution: {
            'clinic-1': 2,
            'clinic-2': 3
          },
          inactiveConnections: 1
        }
      }
    }
  })
  getMetrics(): MetricsResponse {
    this.logger.log('Metrics requested');
    
    const serviceMetrics = this.orchestrationService.getMetrics();
    const gatewayDetailedMetrics = this.orchestrationGateway.getDetailedMetrics();
    
    const response: MetricsResponse = {
      timestamp: new Date().toISOString(),
      orchestrationService: {
        status: serviceMetrics.status === 'healthy' ? 'healthy' : 'unhealthy',
        service: serviceMetrics.service,
        timestamp: serviceMetrics.timestamp,
        websocketMetrics: serviceMetrics.websocketMetrics
      },
      websocketGateway: gatewayDetailedMetrics
    };
    
    return response;
  }
  
  /**
   * WebSocket连接状态端点
   * 
   * 返回WebSocket连接的详细状态
   */
  @Get('connections')
  @ApiOperation({ summary: 'WebSocket连接状态' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '连接状态',
    schema: {
      example: {
        timestamp: '2023-05-14T12:34:56.789Z',
        activeConnections: 5,
        connectionsByRole: {
          doctor: 2,
          patient: 3
        },
        connectionsByClinic: {
          'clinic-1': 2,
          'clinic-2': 3
        }
      }
    }
  })
  getConnectionStatus() {
    this.logger.log('Connection status requested');
    
    const metrics = this.orchestrationGateway.getDetailedMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      activeConnections: metrics.activeConnections,
      connectionsByRole: metrics.roleDistribution,
      connectionsByClinic: metrics.clinicDistribution,
      inactiveConnections: metrics.inactiveConnections
    };
  }
  
  /**
   * 服务版本信息端点
   * 
   * 返回业务编排服务的版本信息
   */
  @Get('version')
  @ApiOperation({ summary: '业务编排服务版本信息' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '版本信息',
    schema: {
      example: {
        version: '1.0.0',
        buildDate: '2023-05-14T00:00:00.000Z',
        environment: 'production'
      }
    }
  })
  getVersionInfo() {
    return {
      version: process.env.APP_VERSION || '1.0.0',
      buildDate: process.env.BUILD_DATE || new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };
  }

  /**
   * 监控仪表板端点
   * 
   * 返回完整的监控仪表板数据，包括增强的性能指标
   */
  @Get('dashboard')
  @ApiOperation({ summary: '监控仪表板数据' })
  @ApiQuery({ 
    name: 'timeRange', 
    required: false, 
    description: '时间范围 (1h, 6h, 24h, 7d)', 
    example: '1h' 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '监控仪表板数据',
    schema: {
      example: {
        timestamp: '2023-05-14T12:34:56.789Z',
        summary: {
          overallHealth: 'healthy',
          totalConnections: 5,
          totalEventsProcessed: 150,
          averageResponseTime: 45.2,
          errorRate: 1.3
        },
        orchestrationService: {
          eventProcessing: {
            totalEventsProcessed: 150,
            averageProcessingTime: 45.2,
            successRate: 98.7,
            failureRate: 1.3
          },
          eventTypeDistribution: {
            'PAYMENT_SUCCEEDED': 75,
            'PAYMENT_FAILED': 5,
            'ORDER_STATUS_CHANGED': 70
          },
          compensationMetrics: {
            totalCompensationsTriggered: 2,
            compensationsByReason: {
              'PAYMENT_SUCCESS_HANDLING_FAILED': 1,
              'ORDER_UPDATE_FAILED': 1
            }
          },
          performanceAnalysis: {
            p50ProcessingTime: 35,
            p95ProcessingTime: 120,
            p99ProcessingTime: 250,
            slowestEventType: 'ORDER_STATUS_CHANGED',
            fastestEventType: 'PAYMENT_SUCCEEDED'
          }
        },
        websocketGateway: {
          connectionMetrics: {
            averageConnectionDuration: 1800000,
            currentConnections: 5,
            peakConnections: 8
          },
          messageMetrics: {
            totalMessagesSent: 300,
            messagesPerSecond: 2.5,
            messagesByEvent: {
              'order.status.updated': 150,
              'payment.succeeded': 75,
              'payment.failed': 5
            }
          },
          slidingWindowMetrics: {
            last1MinuteMessages: 12,
            last5MinuteMessages: 45,
            last1MinuteErrors: 0
          }
        }
      }
    }
  })
  getDashboard(@Query('timeRange') timeRange?: string): DashboardResponse {
    this.logger.log(`Dashboard data requested with time range: ${timeRange || 'default'}`);
    
    // 获取增强的监控指标
    const serviceMetrics = this.orchestrationService.getEnhancedMetrics();
    const gatewayMetrics = this.orchestrationGateway.getEnhancedMetrics();
    
    // 计算总体摘要
    const overallHealth = serviceMetrics.healthMetrics.isHealthy && 
                         this.orchestrationGateway.isHealthy() ? 'healthy' : 'unhealthy';
    
    const response: DashboardResponse = {
      timestamp: new Date().toISOString(),
      summary: {
        overallHealth,
        totalConnections: gatewayMetrics.connectionMetrics.currentConnections,
        totalEventsProcessed: serviceMetrics.eventProcessing.totalEventsProcessed,
        averageResponseTime: serviceMetrics.eventProcessing.averageProcessingTime,
        errorRate: serviceMetrics.eventProcessing.failureRate,
      },
      orchestrationService: serviceMetrics,
      websocketGateway: gatewayMetrics,
    };
    
    return response;
  }

  /**
   * 性能分析端点
   * 
   * 返回详细的性能分析数据
   */
  @Get('performance')
  @ApiOperation({ summary: '性能分析数据' })
  @ApiQuery({ 
    name: 'metric', 
    required: false, 
    description: '指标类型 (latency, throughput, errors)', 
    example: 'latency' 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '性能分析数据'
  })
  getPerformanceAnalysis(@Query('metric') metric?: string) {
    this.logger.log(`Performance analysis requested for metric: ${metric || 'all'}`);
    
    const serviceMetrics = this.orchestrationService.getEnhancedMetrics();
    const gatewayMetrics = this.orchestrationGateway.getEnhancedMetrics();
    
    const response = {
      timestamp: new Date().toISOString(),
      requestedMetric: metric || 'all',
      servicePerformance: {
        processingTimes: serviceMetrics.eventProcessing.eventProcessingTimes,
        percentiles: serviceMetrics.performanceAnalysis,
        eventTypePerformance: serviceMetrics.eventTypeDistribution,
      },
      gatewayPerformance: {
        messageLatencies: gatewayMetrics.performanceMetrics,
        connectionMetrics: gatewayMetrics.connectionMetrics,
        throughput: gatewayMetrics.messageMetrics,
      },
      recommendations: this.generatePerformanceRecommendations(serviceMetrics, gatewayMetrics),
    };
    
    return response;
  }

  /**
   * 实时监控端点
   * 
   * 返回实时监控数据，用于实时仪表板更新
   */
  @Get('realtime')
  @ApiOperation({ summary: '实时监控数据' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '实时监控数据'
  })
  getRealtimeMetrics() {
    this.logger.log('Realtime metrics requested');
    
    const serviceMetrics = this.orchestrationService.getEnhancedMetrics();
    const gatewayMetrics = this.orchestrationGateway.getEnhancedMetrics();
    
    const response = {
      timestamp: new Date().toISOString(),
      realtime: {
        currentConnections: gatewayMetrics.connectionMetrics.currentConnections,
        messagesPerSecond: gatewayMetrics.messageMetrics.messagesPerSecond,
        last1MinuteMessages: gatewayMetrics.slidingWindowMetrics.last1MinuteMessages,
        last1MinuteErrors: gatewayMetrics.slidingWindowMetrics.last1MinuteErrors,
        currentErrorRate: serviceMetrics.eventProcessing.failureRate,
        averageProcessingTime: serviceMetrics.eventProcessing.averageProcessingTime,
        healthStatus: {
          service: serviceMetrics.healthMetrics.isHealthy,
          gateway: this.orchestrationGateway.isHealthy(),
        },
      },
      alerts: this.generateAlerts(serviceMetrics, gatewayMetrics),
    };
    
    return response;
  }

  /**
   * 重置监控指标端点
   * 
   * 重置所有监控指标计数器
   */
  @Get('reset-metrics')
  @ApiOperation({ summary: '重置监控指标' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '指标重置成功'
  })
  resetMetrics() {
    this.logger.log('Metrics reset requested');
    
    this.orchestrationService.resetMetrics();
    this.orchestrationGateway.resetPeakConnections();
    
    return {
      message: 'Metrics reset successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 生成性能建议
   */
  private generatePerformanceRecommendations(serviceMetrics: any, gatewayMetrics: any): string[] {
    const recommendations: string[] = [];
    
    // 检查处理时间
    if (serviceMetrics.eventProcessing.averageProcessingTime > 100) {
      recommendations.push('事件处理时间较长，建议优化事件处理逻辑');
    }
    
    // 检查错误率
    if (serviceMetrics.eventProcessing.failureRate > 5) {
      recommendations.push('错误率较高，建议检查错误处理机制');
    }
    
    // 检查连接数
    if (gatewayMetrics.connectionMetrics.currentConnections > 100) {
      recommendations.push('连接数较多，建议考虑负载均衡');
    }
    
    // 检查消息延迟
    if (gatewayMetrics.performanceMetrics.p95Latency > 200) {
      recommendations.push('消息延迟较高，建议优化网络配置');
    }
    
    // 检查补偿触发次数
    if (serviceMetrics.compensationMetrics.totalCompensationsTriggered > 10) {
      recommendations.push('补偿机制触发频繁，建议检查业务逻辑稳定性');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('系统运行良好，暂无优化建议');
    }
    
    return recommendations;
  }

  /**
   * 生成告警信息
   */
  private generateAlerts(serviceMetrics: any, gatewayMetrics: any): Array<{level: string, message: string, timestamp: string}> {
    const alerts: Array<{level: string, message: string, timestamp: string}> = [];
    const now = new Date().toISOString();
    
    // 错误率告警
    if (serviceMetrics.eventProcessing.failureRate > 10) {
      alerts.push({
        level: 'error',
        message: `事件处理错误率过高: ${serviceMetrics.eventProcessing.failureRate.toFixed(2)}%`,
        timestamp: now,
      });
    } else if (serviceMetrics.eventProcessing.failureRate > 5) {
      alerts.push({
        level: 'warning',
        message: `事件处理错误率偏高: ${serviceMetrics.eventProcessing.failureRate.toFixed(2)}%`,
        timestamp: now,
      });
    }
    
    // 处理时间告警
    if (serviceMetrics.performanceAnalysis.p95ProcessingTime > 500) {
      alerts.push({
        level: 'error',
        message: `事件处理时间过长: P95=${serviceMetrics.performanceAnalysis.p95ProcessingTime}ms`,
        timestamp: now,
      });
    }
    
    // 连接告警
    if (gatewayMetrics.errorMetrics.connectionErrors > 50) {
      alerts.push({
        level: 'warning',
        message: `连接错误数量较多: ${gatewayMetrics.errorMetrics.connectionErrors}`,
        timestamp: now,
      });
    }
    
    // 健康状态告警
    if (!serviceMetrics.healthMetrics.isHealthy) {
      alerts.push({
        level: 'error',
        message: '编排服务健康状态异常',
        timestamp: now,
      });
    }
    
    return alerts;
  }

  /**
   * 获取死信队列状态
   */
  @Get('dead-letter-queue')
  @ApiOperation({ summary: '获取死信队列状态' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '返回死信队列状态',
    schema: {
      type: 'object',
      properties: {
        size: { type: 'number' },
        items: { type: 'array' },
        oldestItem: { type: 'object' },
        newestItem: { type: 'object' },
      },
    },
  })
  getDeadLetterQueueStatus() {
    this.logger.log('Dead letter queue status requested');
    return this.orchestrationService.getDeadLetterQueueStatus();
  }

  /**
   * 清理死信队列
   */
  @Delete('dead-letter-queue')
  @ApiOperation({ summary: '清理死信队列' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '死信队列已清理',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        timestamp: { type: 'string' },
      },
    },
  })
  clearDeadLetterQueue() {
    this.logger.log('Dead letter queue clear requested');
    this.orchestrationService.clearDeadLetterQueue();
    return {
      message: 'Dead letter queue cleared successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 重新处理死信队列
   */
  @Post('dead-letter-queue/reprocess')
  @ApiOperation({ summary: '重新处理死信队列中的事件' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '死信队列重新处理结果',
    schema: {
      type: 'object',
      properties: {
        processed: { type: 'number' },
        failed: { type: 'number' },
        timestamp: { type: 'string' },
      },
    },
  })
  async reprocessDeadLetterQueue() {
    this.logger.log('Dead letter queue reprocess requested');
    const result = await this.orchestrationService.reprocessDeadLetterQueue();
    return {
      ...result,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 查询事件列表
   * 
   * 返回持久化的事件列表，支持过滤和分页
   */
  @Get('events')
  @ApiOperation({ summary: '查询事件列表' })
  @ApiQuery({ name: 'eventType', required: false, description: '事件类型过滤' })
  @ApiQuery({ name: 'processingStatus', required: false, enum: EventProcessingStatus, description: '处理状态过滤' })
  @ApiQuery({ name: 'startDate', required: false, type: Date, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, type: Date, description: '结束日期' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量', example: 100 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '事件列表',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          eventType: { type: 'string' },
          eventId: { type: 'string' },
          payload: { type: 'object' },
          metadata: { type: 'object' },
          processingStatus: { type: 'string', enum: Object.values(EventProcessingStatus) },
          processingAttempts: { type: 'number' },
          lastProcessingError: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          processedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  })
  async getEvents(
    @Query('eventType') eventType?: string,
    @Query('processingStatus') processingStatus?: EventProcessingStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`Events query requested with filters: ${JSON.stringify({ eventType, processingStatus, startDate, endDate, page, limit })}`);
    
    const filters = {
      eventType,
      processingStatus,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 100,
    };
    
    return await this.eventPersistenceService.getEvents(filters);
  }

  /**
   * 获取事件统计信息
   * 
   * 返回事件的统计数据，包括按类型和状态的分布
   */
  @Get('events/stats')
  @ApiOperation({ summary: '获取事件统计信息' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '事件统计信息',
    schema: {
      type: 'object',
      properties: {
        totalEvents: { type: 'number' },
        eventsByType: {
          type: 'object',
          additionalProperties: { type: 'number' },
        },
        eventsByStatus: {
          type: 'object',
          additionalProperties: { type: 'number' },
        },
      },
    },
  })
  async getEventStats() {
    this.logger.log('Event statistics requested');
    
    return await this.eventPersistenceService.getEventStats();
  }

  /**
   * 获取单个事件详情
   * 
   * 根据事件ID返回事件的详细信息
   */
  @Get('events/:id')
  @ApiOperation({ summary: '获取单个事件详情' })
  @ApiParam({ name: 'id', description: '事件ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '事件详情',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        eventType: { type: 'string' },
        eventId: { type: 'string' },
        payload: { type: 'object' },
        metadata: { type: 'object' },
        processingStatus: { type: 'string', enum: Object.values(EventProcessingStatus) },
        processingAttempts: { type: 'number' },
        lastProcessingError: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        processedAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '事件不存在',
  })
  async getEventById(@Param('id') id: string) {
    this.logger.log(`Event details requested for ID: ${id}`);
    
    const event = await this.eventPersistenceService.getEventById(id);
    
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }
    
    return event;
  }

  /**
   * 重放特定事件
   * 
   * 重新处理指定的事件
   */
  @Post('events/:id/replay')
  @ApiOperation({ summary: '重放特定事件' })
  @ApiParam({ name: 'id', description: '事件ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '事件重放成功',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        eventId: { type: 'string' },
        eventType: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '事件不存在',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '事件无法重放',
  })
  async replayEvent(@Param('id') id: string) {
    this.logger.log(`Event replay requested for ID: ${id}`);
    
    // 获取事件详情
    const event = await this.eventPersistenceService.getEventById(id);
    
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }
    
    // 增加处理尝试次数
    await this.eventPersistenceService.incrementAttempts(event.id);
    
    try {
      // 根据事件类型重新发布事件
      switch (event.eventType) {
        case PAYMENT_EVENTS.PAYMENT_SUCCEEDED:
          this.eventEmitter.emit(PAYMENT_EVENTS.PAYMENT_SUCCEEDED, event.payload);
          break;
        case PAYMENT_EVENTS.PAYMENT_FAILED:
          this.eventEmitter.emit(PAYMENT_EVENTS.PAYMENT_FAILED, event.payload);
          break;
        case ORDER_EVENTS.ORDER_STATUS_CHANGED:
          this.eventEmitter.emit(ORDER_EVENTS.ORDER_STATUS_CHANGED, event.payload);
          break;
        default:
          throw new BadRequestException(`Event type ${event.eventType} cannot be replayed`);
      }
      
      // 更新事件状态为处理中
      await this.eventPersistenceService.updateEventStatus(event.id, EventProcessingStatus.PROCESSING);
      
      return {
        message: 'Event replayed successfully',
        eventId: event.id,
        eventType: event.eventType,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // 更新事件状态为失败
      await this.eventPersistenceService.updateEventStatus(
        event.id,
        EventProcessingStatus.FAILED,
        error.message
      );
      
      throw error;
    }
  }
} 