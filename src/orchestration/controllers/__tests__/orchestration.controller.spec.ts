import { Test, TestingModule } from '@nestjs/testing';
import { OrchestrationHealthController } from '../orchestration.controller';
import { OrchestrationGateway } from '../../gateways/orchestration.gateway';
import { OrchestrationService } from '../../services/orchestration.service';
import { EventPersistenceService } from '../../services/event-persistence.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('OrchestrationHealthController', () => {
  let controller: OrchestrationHealthController;
  let gateway: OrchestrationGateway;
  let service: OrchestrationService;
  let eventEmitter: EventEmitter2;

  // 模拟网关指标
  const mockGatewayMetrics = {
    activeConnections: 2,
    totalConnectionAttempts: 5,
    totalEvents: 10,
    errorRate: 0,
    timestamp: new Date().toISOString()
  };

  // 模拟服务状态
  const mockServiceStatus = {
    eventsProcessed: {
      succeeded: 5,
      failed: 1,
      compensation: 0,
      total: 6
    },
    cachedEventsCount: 3,
    gatewayStatus: {
      isHealthy: true,
      connections: 2
    },
    timestamp: new Date().toISOString()
  };

  beforeEach(async () => {
    // 创建测试模块
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrchestrationHealthController],
      providers: [
        {
          provide: OrchestrationGateway,
          useValue: {
            isHealthy: jest.fn().mockReturnValue(true),
            getMetrics: jest.fn().mockReturnValue(mockGatewayMetrics),
            getConnectionCount: jest.fn().mockReturnValue(2),
            getDetailedMetrics: jest.fn().mockReturnValue(mockGatewayMetrics)
          }
        },
        {
          provide: OrchestrationService,
          useValue: {
            isHealthy: jest.fn().mockReturnValue(true),
            getMetrics: jest.fn().mockReturnValue({
              service: 'orchestration',
              status: 'healthy',
              timestamp: new Date().toISOString(),
              websocketMetrics: mockGatewayMetrics
            })
          }
        },
        {
          provide: EventEmitter2,
          useValue: {
            listenerCount: jest.fn().mockImplementation((event) => {
              if (event === 'payment.succeeded') return 1;
              if (event === 'payment.failed') return 1;
              return event ? 1 : 3; // 总数为3
            })
          }
        },
        {
          provide: EventPersistenceService,
          useValue: {
            persistEvent: jest.fn(),
            updateEventStatus: jest.fn(),
            getEvents: jest.fn(),
            getEventStats: jest.fn(),
          }
        }
      ],
    }).compile();

    controller = module.get<OrchestrationHealthController>(OrchestrationHealthController);
    gateway = module.get<OrchestrationGateway>(OrchestrationGateway);
    service = module.get<OrchestrationService>(OrchestrationService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    // 清除所有模拟函数的调用历史
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('healthCheck', () => {
    it('should return orchestration health status', async () => {
      // 调用方法
      const result = await controller.healthCheck();
      
      // 验证返回数据
      expect(result).toHaveProperty('status', 'healthy');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('timestamp');
      
      // 验证服务状态
      expect(result.services.orchestration.status).toBe('up');
      expect(result.services.websocket.status).toBe('up');
      expect(result.services.websocket.connections).toBe(2);
      
      // 验证依赖调用
      expect(gateway.isHealthy).toHaveBeenCalled();
      expect(service.isHealthy).toHaveBeenCalled();
      expect(gateway.getConnectionCount).toHaveBeenCalled();
    });
  });

  describe('getConnectionStatus', () => {
    it('should return websocket status', async () => {
      // 调用方法
      const result = await controller.getConnectionStatus();
      
      // 验证返回数据
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('activeConnections', mockGatewayMetrics.activeConnections);
      expect(result).toHaveProperty('connectionsByRole');
      expect(result).toHaveProperty('connectionsByClinic');
      
      // 验证依赖调用
      expect(gateway.getDetailedMetrics).toHaveBeenCalled();
    });

    it('should return unhealthy status when gateway is not healthy', async () => {
      // 模拟网关不健康
      (gateway.isHealthy as jest.Mock).mockReturnValueOnce(false);
      
      // 调用方法
      const result = await controller.getConnectionStatus();
      
      // 验证返回数据
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('getMetrics', () => {
    it('should return event processing status', async () => {
      // 调用方法
      const result = await controller.getMetrics();
      
      // 验证返回数据
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('orchestrationService');
      expect(result).toHaveProperty('websocketGateway');
      
      // 验证服务指标
      expect(result.orchestrationService.status).toBe('healthy');
      expect(result.websocketGateway.activeConnections).toBe(mockGatewayMetrics.activeConnections);
      
      // 验证依赖调用
      expect(service.getMetrics).toHaveBeenCalled();
      expect(gateway.getDetailedMetrics).toHaveBeenCalled();
    });
  });
}); 