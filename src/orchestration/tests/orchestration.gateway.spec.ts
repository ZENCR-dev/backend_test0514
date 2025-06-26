import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "../../auth/auth.service";
import { OrchestrationGateway } from "../gateways/orchestration.gateway";
import { Logger, UnauthorizedException } from "@nestjs/common";
import { Socket, Server } from "socket.io";
import { ORCHESTRATION_EVENTS } from "../../common/events/types";

// 模拟Socket.io
const mockSocket = {
  id: "socket-123",
  handshake: {
    auth: {
      token: "valid-token",
    },
  },
  data: {},
  emit: jest.fn(),
  disconnect: jest.fn(),
  conn: {
    on: jest.fn(),
  },
} as unknown as Socket;

// 模拟Server
const mockServer = {
  emit: jest.fn(),
  engine: {
    clientsCount: 5,
  },
} as unknown as Server;

// 模拟JWT服务
const mockJwtService = {
  verify: jest.fn(),
};

// 模拟认证服务
const mockAuthService = {
  verifyPayload: jest.fn(),
};

describe("OrchestrationGateway", () => {
  let gateway: OrchestrationGateway;
  let jwtService: JwtService;
  let authService: AuthService;

  beforeEach(async () => {
    // 重置所有模拟函数
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationGateway,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    // 禁用Logger输出
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "debug").mockImplementation(() => {});

    gateway = module.get<OrchestrationGateway>(OrchestrationGateway);
    jwtService = module.get<JwtService>(JwtService);
    authService = module.get<AuthService>(AuthService);

    // 设置模拟的WebSocket服务器
    gateway.server = mockServer;
  });

  it("should be defined", () => {
    expect(gateway).toBeDefined();
  });

  describe("handleConnection", () => {
    it("should authenticate and connect valid users", async () => {
      // 模拟JWT验证和用户验证
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        role: "doctor",
        clinicId: "clinic-123",
      };
      mockJwtService.verify.mockReturnValue({ sub: "user-123" });
      mockAuthService.verifyPayload.mockResolvedValue(mockUser);

      // 调用连接处理方法
      await gateway.handleConnection(mockSocket);

      // 验证JWT验证被调用
      expect(mockJwtService.verify).toHaveBeenCalledWith("valid-token");

      // 验证用户验证被调用
      expect(mockAuthService.verifyPayload).toHaveBeenCalled();

      // 验证用户数据被存储
      expect(mockSocket.data.user).toEqual(mockUser);

      // 验证连接状态事件被发送
      expect(mockSocket.emit).toHaveBeenCalledWith(
        ORCHESTRATION_EVENTS.CONNECTION_STATUS,
        expect.objectContaining({
          connected: true,
          userId: "user-123",
        }),
      );
    });

    it("should reject connections without token", async () => {
      // 模拟没有token的连接
      const socketWithoutToken = {
        ...mockSocket,
        handshake: { auth: {} },
      } as unknown as Socket;

      // 调用连接处理方法
      await gateway.handleConnection(socketWithoutToken);

      // 验证错误事件被发送
      expect(socketWithoutToken.emit).toHaveBeenCalledWith(
        ORCHESTRATION_EVENTS.ERROR,
        expect.objectContaining({
          message: "Authentication failed",
        }),
      );

      // 验证连接被断开
      expect(socketWithoutToken.disconnect).toHaveBeenCalled();
    });

    it("should reject connections with invalid token", async () => {
      // 模拟JWT验证失败
      mockJwtService.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      // 调用连接处理方法
      await gateway.handleConnection(mockSocket);

      // 验证错误事件被发送
      expect(mockSocket.emit).toHaveBeenCalledWith(
        ORCHESTRATION_EVENTS.ERROR,
        expect.objectContaining({
          message: "Authentication failed",
        }),
      );

      // 验证连接被断开
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it("should reject connections with valid token but inactive user", async () => {
      // 模拟JWT验证成功但用户验证失败
      mockJwtService.verify.mockReturnValue({ sub: "user-123" });
      mockAuthService.verifyPayload.mockResolvedValue(null);

      // 调用连接处理方法
      await gateway.handleConnection(mockSocket);

      // 验证错误事件被发送
      expect(mockSocket.emit).toHaveBeenCalledWith(
        ORCHESTRATION_EVENTS.ERROR,
        expect.objectContaining({
          message: "Authentication failed",
        }),
      );

      // 验证连接被断开
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it("should disconnect previous connection when same user connects again", async () => {
      // 模拟JWT验证和用户验证
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        role: "doctor",
      };
      mockJwtService.verify.mockReturnValue({ sub: "user-123" });
      mockAuthService.verifyPayload.mockResolvedValue(mockUser);

      // 创建第一个连接
      const firstSocket = {
        ...mockSocket,
        id: "socket-1",
      } as unknown as Socket;
      await gateway.handleConnection(firstSocket);

      // 创建第二个连接（同一用户）
      const secondSocket = {
        ...mockSocket,
        id: "socket-2",
      } as unknown as Socket;
      await gateway.handleConnection(secondSocket);

      // 验证第一个连接被断开
      expect(firstSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe("handleDisconnect", () => {
    it("should remove client from connected clients on disconnect", async () => {
      // 首先连接一个客户端
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        role: "doctor",
      };
      mockJwtService.verify.mockReturnValue({ sub: "user-123" });
      mockAuthService.verifyPayload.mockResolvedValue(mockUser);

      await gateway.handleConnection(mockSocket);

      // 然后断开连接
      gateway.handleDisconnect(mockSocket);

      // 验证用户不再连接
      expect(gateway.isUserConnected("user-123")).toBe(false);
    });

    it("should handle disconnect for unauthenticated clients", () => {
      // 创建没有用户数据的Socket
      const unauthSocket = { ...mockSocket, data: {} } as unknown as Socket;

      // 调用断开连接处理方法
      gateway.handleDisconnect(unauthSocket);

      // 这里主要是验证方法不会抛出错误
      expect(() => gateway.handleDisconnect(unauthSocket)).not.toThrow();
    });
  });

  describe("broadcasting and messaging", () => {
    it("should broadcast events to all clients", () => {
      // 广播事件
      const eventData = { message: "test message" };
      gateway.broadcastEvent("test-event", eventData);

      // 验证服务器广播方法被调用
      expect(mockServer.emit).toHaveBeenCalledWith("test-event", eventData);
    });

    it("should send events to specific users", async () => {
      // 首先连接一个客户端
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        role: "doctor",
      };
      mockJwtService.verify.mockReturnValue({ sub: "user-123" });
      mockAuthService.verifyPayload.mockResolvedValue(mockUser);

      await gateway.handleConnection(mockSocket);

      // 发送事件到特定用户
      const eventData = { message: "test message" };
      const result = gateway.sendToUser("user-123", "test-event", eventData);

      // 验证事件被发送
      expect(mockSocket.emit).toHaveBeenCalledWith("test-event", eventData);
      expect(result).toBe(true);
    });

    it("should return false when sending to non-connected user", () => {
      // 发送事件到不存在的用户
      const eventData = { message: "test message" };
      const result = gateway.sendToUser(
        "non-existent-user",
        "test-event",
        eventData,
      );

      // 验证返回false
      expect(result).toBe(false);
    });

    it("should send events to users in specific clinic", async () => {
      // 首先连接两个属于同一诊所的客户端
      const mockUser1 = {
        id: "user-1",
        email: "user1@example.com",
        role: "doctor",
        clinicId: "clinic-123",
      };
      const mockUser2 = {
        id: "user-2",
        email: "user2@example.com",
        role: "nurse",
        clinicId: "clinic-123",
      };
      const mockUser3 = {
        id: "user-3",
        email: "user3@example.com",
        role: "doctor",
        clinicId: "clinic-456",
      };

      mockJwtService.verify.mockReturnValue({});

      // 创建独立的mock函数为每个socket
      const socket1Emit = jest.fn();
      const socket2Emit = jest.fn();
      const socket3Emit = jest.fn();

      // 模拟三个不同用户的连接
      const socket1 = {
        ...mockSocket,
        id: "socket-1",
        emit: socket1Emit,
        handshake: { auth: { token: "mock-token" } },
      } as unknown as Socket;
      const socket2 = {
        ...mockSocket,
        id: "socket-2",
        emit: socket2Emit,
        handshake: { auth: { token: "mock-token" } },
      } as unknown as Socket;
      const socket3 = {
        ...mockSocket,
        id: "socket-3",
        emit: socket3Emit,
        handshake: { auth: { token: "mock-token" } },
      } as unknown as Socket;

      mockAuthService.verifyPayload
        .mockResolvedValueOnce(mockUser1)
        .mockResolvedValueOnce(mockUser2)
        .mockResolvedValueOnce(mockUser3);

      await gateway.handleConnection(socket1);
      await gateway.handleConnection(socket2);
      await gateway.handleConnection(socket3);

      // 清除连接过程中的emit调用记录（包括connection_status事件）
      socket1Emit.mockClear();
      socket2Emit.mockClear();
      socket3Emit.mockClear();

      // 发送事件到特定诊所
      const eventData = { message: "clinic message" };
      const sentCount = gateway.sendToClinic(
        "clinic-123",
        "clinic-event",
        eventData,
      );

      // 验证事件被发送到两个用户
      expect(sentCount).toBe(2);
      expect(socket1Emit).toHaveBeenCalledWith("clinic-event", eventData);
      expect(socket2Emit).toHaveBeenCalledWith("clinic-event", eventData);
      expect(socket3Emit).not.toHaveBeenCalled();
    });

    it("should send events to users with specific role", async () => {
      // 首先连接三个不同角色的客户端
      const mockUser1 = {
        id: "user-1",
        email: "user1@example.com",
        role: "doctor",
        clinicId: "clinic-123",
      };
      const mockUser2 = {
        id: "user-2",
        email: "user2@example.com",
        role: "nurse",
        clinicId: "clinic-123",
      };
      const mockUser3 = {
        id: "user-3",
        email: "user3@example.com",
        role: "doctor",
        clinicId: "clinic-456",
      };

      mockJwtService.verify.mockReturnValue({});

      // 创建独立的mock函数为每个socket
      const socket1Emit = jest.fn();
      const socket2Emit = jest.fn();
      const socket3Emit = jest.fn();

      // 模拟三个不同用户的连接
      const socket1 = {
        ...mockSocket,
        id: "socket-1",
        emit: socket1Emit,
        handshake: { auth: { token: "mock-token" } },
      } as unknown as Socket;
      const socket2 = {
        ...mockSocket,
        id: "socket-2",
        emit: socket2Emit,
        handshake: { auth: { token: "mock-token" } },
      } as unknown as Socket;
      const socket3 = {
        ...mockSocket,
        id: "socket-3",
        emit: socket3Emit,
        handshake: { auth: { token: "mock-token" } },
      } as unknown as Socket;

      mockAuthService.verifyPayload
        .mockResolvedValueOnce(mockUser1)
        .mockResolvedValueOnce(mockUser2)
        .mockResolvedValueOnce(mockUser3);

      await gateway.handleConnection(socket1);
      await gateway.handleConnection(socket2);
      await gateway.handleConnection(socket3);

      // 清除连接过程中的emit调用记录（包括connection_status事件）
      socket1Emit.mockClear();
      socket2Emit.mockClear();
      socket3Emit.mockClear();

      // 发送事件到特定角色
      const eventData = { message: "doctor message" };
      const sentCount = gateway.sendToRole("doctor", "role-event", eventData);

      // 验证事件被发送到两个医生
      expect(sentCount).toBe(2);
      expect(socket1Emit).toHaveBeenCalledWith("role-event", eventData);
      expect(socket2Emit).not.toHaveBeenCalled();
      expect(socket3Emit).toHaveBeenCalledWith("role-event", eventData);
    });
  });

  describe("health and metrics", () => {
    it("should report healthy status when server is available", () => {
      expect(gateway.isHealthy()).toBe(true);
    });

    it("should return connection metrics", async () => {
      // 连接一个用户
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        role: "doctor",
      };
      mockJwtService.verify.mockReturnValue({});
      mockAuthService.verifyPayload.mockResolvedValue(mockUser);

      await gateway.handleConnection(mockSocket);

      // 获取指标
      const metrics = gateway.getMetrics();

      // 验证指标格式
      expect(metrics).toEqual(
        expect.objectContaining({
          activeConnections: expect.any(Number),
          totalConnectionAttempts: expect.any(Number),
          totalEvents: expect.any(Number),
          errorRate: expect.any(Number),
        }),
      );
    });

    it("should return detailed metrics", async () => {
      // 连接一个用户
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        role: "doctor",
        clinicId: "clinic-123",
      };
      mockJwtService.verify.mockReturnValue({});
      mockAuthService.verifyPayload.mockResolvedValue(mockUser);

      await gateway.handleConnection(mockSocket);

      // 获取详细指标
      const detailedMetrics = gateway.getDetailedMetrics();

      // 验证详细指标格式
      expect(detailedMetrics).toEqual(
        expect.objectContaining({
          activeConnections: expect.any(Number),
          totalConnectionAttempts: expect.any(Number),
          totalEvents: expect.any(Number),
          errorRate: expect.any(Number),
          roleDistribution: expect.objectContaining({
            doctor: 1,
          }),
          clinicDistribution: expect.objectContaining({
            "clinic-123": 1,
          }),
          inactiveConnections: expect.any(Number),
        }),
      );
    });
  });
});
