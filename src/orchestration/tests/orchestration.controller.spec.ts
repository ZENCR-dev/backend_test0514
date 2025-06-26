import { Test, TestingModule } from "@nestjs/testing";
import { OrchestrationHealthController } from "../controllers/orchestration.controller";
import { OrchestrationService } from "../services/orchestration.service";
import { OrchestrationGateway } from "../gateways/orchestration.gateway";
import { EventPersistenceService } from "../services/event-persistence.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Logger } from "@nestjs/common";

// 模拟依赖
const mockOrchestrationService = {
  isHealthy: jest.fn(),
  getMetrics: jest.fn(),
};

const mockOrchestrationGateway = {
  isHealthy: jest.fn(),
  getConnectionCount: jest.fn(),
  getMetrics: jest.fn(),
  getDetailedMetrics: jest.fn(),
};

const mockEventPersistenceService = {
  persistEvent: jest.fn(),
  updateEventStatus: jest.fn(),
  getEventById: jest.fn(),
  queryEvents: jest.fn(),
  getEventStats: jest.fn(),
  findEventsByStatus: jest.fn(),
  findEventsByType: jest.fn(),
  findEventsByDateRange: jest.fn(),
  deleteExpiredEvents: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
};

describe("OrchestrationHealthController", () => {
  let controller: OrchestrationHealthController;
  let orchestrationService: OrchestrationService;
  let orchestrationGateway: OrchestrationGateway;
  let eventPersistenceService: EventPersistenceService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    // 重置所有模拟函数
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrchestrationHealthController],
      providers: [
        {
          provide: OrchestrationService,
          useValue: mockOrchestrationService,
        },
        {
          provide: OrchestrationGateway,
          useValue: mockOrchestrationGateway,
        },
        {
          provide: EventPersistenceService,
          useValue: mockEventPersistenceService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    // 禁用Logger输出
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "debug").mockImplementation(() => {});

    controller = module.get<OrchestrationHealthController>(
      OrchestrationHealthController,
    );
    orchestrationService =
      module.get<OrchestrationService>(OrchestrationService);
    orchestrationGateway =
      module.get<OrchestrationGateway>(OrchestrationGateway);
    eventPersistenceService = module.get<EventPersistenceService>(
      EventPersistenceService,
    );
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("healthCheck", () => {
    it("should return healthy status when all services are healthy", () => {
      // 模拟服务健康状态
      mockOrchestrationService.isHealthy.mockReturnValue(true);
      mockOrchestrationGateway.isHealthy.mockReturnValue(true);
      mockOrchestrationGateway.getConnectionCount.mockReturnValue(5);

      // 调用健康检查
      const result = controller.healthCheck();

      // 验证结果
      expect(result.status).toBe("healthy");
      expect(result.services.orchestration.status).toBe("up");
      expect(result.services.websocket.status).toBe("up");
      expect(result.services.websocket.connections).toBe(5);
      expect(result.services.orchestration.details).toBeUndefined();
      expect(result.services.websocket.details).toBeUndefined();
    });

    it("should return unhealthy status when orchestration service is unhealthy", () => {
      // 模拟服务健康状态
      mockOrchestrationService.isHealthy.mockReturnValue(false);
      mockOrchestrationGateway.isHealthy.mockReturnValue(true);
      mockOrchestrationGateway.getConnectionCount.mockReturnValue(5);

      // 调用健康检查
      const result = controller.healthCheck();

      // 验证结果
      expect(result.status).toBe("unhealthy");
      expect(result.services.orchestration.status).toBe("down");
      expect(result.services.websocket.status).toBe("up");
      expect(result.services.orchestration.details).toBeDefined();
    });

    it("should return unhealthy status when websocket gateway is unhealthy", () => {
      // 模拟服务健康状态
      mockOrchestrationService.isHealthy.mockReturnValue(true);
      mockOrchestrationGateway.isHealthy.mockReturnValue(false);
      mockOrchestrationGateway.getConnectionCount.mockReturnValue(0);

      // 调用健康检查
      const result = controller.healthCheck();

      // 验证结果
      expect(result.status).toBe("unhealthy");
      expect(result.services.orchestration.status).toBe("up");
      expect(result.services.websocket.status).toBe("down");
      expect(result.services.websocket.details).toBeDefined();
    });
  });

  describe("getMetrics", () => {
    it("should return metrics from both services", () => {
      // 模拟服务指标
      mockOrchestrationService.getMetrics.mockReturnValue({
        service: "orchestration",
        status: "healthy",
        timestamp: "2023-05-14T12:34:56.789Z",
        websocketMetrics: {
          activeConnections: 5,
        },
      });

      mockOrchestrationGateway.getDetailedMetrics.mockReturnValue({
        activeConnections: 5,
        totalConnectionAttempts: 10,
        totalEvents: 20,
        errorRate: 0,
        roleDistribution: {
          doctor: 3,
          patient: 2,
        },
        clinicDistribution: {
          "clinic-1": 3,
          "clinic-2": 2,
        },
        inactiveConnections: 1,
      });

      // 调用指标端点
      const result = controller.getMetrics();

      // 验证结果
      expect(result).toEqual({
        timestamp: expect.any(String),
        orchestrationService: expect.objectContaining({
          service: "orchestration",
          status: "healthy",
        }),
        websocketGateway: expect.objectContaining({
          activeConnections: 5,
          totalConnectionAttempts: 10,
          totalEvents: 20,
          errorRate: 0,
          roleDistribution: expect.any(Object),
          clinicDistribution: expect.any(Object),
        }),
      });
    });
  });

  describe("getConnectionStatus", () => {
    it("should return connection status details", () => {
      // 模拟连接指标
      mockOrchestrationGateway.getDetailedMetrics.mockReturnValue({
        activeConnections: 5,
        totalConnectionAttempts: 10,
        totalEvents: 20,
        errorRate: 0,
        roleDistribution: {
          doctor: 3,
          patient: 2,
        },
        clinicDistribution: {
          "clinic-1": 3,
          "clinic-2": 2,
        },
        inactiveConnections: 1,
      });

      // 调用连接状态端点
      const result = controller.getConnectionStatus();

      // 验证结果
      expect(result).toEqual({
        timestamp: expect.any(String),
        activeConnections: 5,
        connectionsByRole: {
          doctor: 3,
          patient: 2,
        },
        connectionsByClinic: {
          "clinic-1": 3,
          "clinic-2": 2,
        },
        inactiveConnections: 1,
      });
    });
  });

  describe("getVersionInfo", () => {
    it("should return version information", () => {
      // 保存原始环境变量
      const originalEnv = process.env;

      // 设置测试环境变量
      process.env.APP_VERSION = "1.2.3";
      process.env.BUILD_DATE = "2023-05-14T00:00:00.000Z";
      process.env.NODE_ENV = "production";

      // 调用版本信息端点
      const result = controller.getVersionInfo();

      // 验证结果
      expect(result).toEqual({
        version: "1.2.3",
        buildDate: "2023-05-14T00:00:00.000Z",
        environment: "production",
      });

      // 恢复原始环境变量
      process.env = originalEnv;
    });

    it("should return default values when environment variables are not set", () => {
      // 保存原始环境变量
      const originalEnv = process.env;

      // 删除相关环境变量
      delete process.env.APP_VERSION;
      delete process.env.BUILD_DATE;
      delete process.env.NODE_ENV;

      // 调用版本信息端点
      const result = controller.getVersionInfo();

      // 验证结果
      expect(result).toEqual({
        version: "1.0.0",
        buildDate: expect.any(String),
        environment: "development",
      });

      // 恢复原始环境变量
      process.env = originalEnv;
    });
  });
});
