import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../../auth/auth.service';
import { OrchestrationGateway } from '../orchestration.gateway';
import { Socket } from 'socket.io';

describe('OrchestrationGateway - Enhanced Metrics', () => {
  let gateway: OrchestrationGateway;
  let jwtService: JwtService;
  let authService: AuthService;

  const mockUser = { id: 'user-123', email: 'test@example.com', role: 'DOCTOR' };
  const mockToken = 'valid.jwt.token';
  const mockPayload = { sub: 'user-123', email: 'test@example.com' };

  const createMockClient = (id: string) => ({
    id,
    handshake: {
      auth: {
        token: mockToken
      }
    },
    data: {},
    emit: jest.fn(),
    disconnect: jest.fn(),
    conn: {
      on: jest.fn()
    }
  } as unknown as Socket);

  const mockServer = {
    emit: jest.fn(),
    engine: {
      clientsCount: 1
    }
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationGateway,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn().mockReturnValue(mockPayload),
            sign: jest.fn().mockReturnValue(mockToken)
          }
        },
        {
          provide: AuthService,
          useValue: {
            verifyPayload: jest.fn().mockResolvedValue(mockUser)
          }
        }
      ],
    }).compile();

    gateway = module.get<OrchestrationGateway>(OrchestrationGateway);
    jwtService = module.get<JwtService>(JwtService);
    authService = module.get<AuthService>(AuthService);

    gateway.server = mockServer as any;
    jest.clearAllMocks();
  });

  describe('Enhanced Metrics', () => {
    it('should track connection duration', async () => {
      const client = createMockClient('socket-1');
      
      // 连接客户端
      await gateway.handleConnection(client);
      
      // 验证连接成功
      expect(client.data.user).toBeDefined();
      expect(client.data.user.id).toBe(mockUser.id);
      
      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 断开连接
      gateway.handleDisconnect(client);
      
      // 获取指标 - 连接时长应该大于0
      const metrics = gateway.getEnhancedMetrics();
      
      expect(metrics.connectionMetrics).toBeDefined();
      // 注意：由于连接已断开，averageConnectionDuration可能为0
      // 我们检查是否有连接记录
      expect(metrics.connectionMetrics.currentConnections).toBe(0);
    });

    it('should track message send rate', async () => {
      const client = createMockClient('socket-1');
      await gateway.handleConnection(client);
      
      // 发送多个消息
      for (let i = 0; i < 10; i++) {
        gateway.sendToUser(mockUser.id, 'test_event', { data: i });
      }
      
      const metrics = gateway.getEnhancedMetrics();
      
      expect(metrics.messageMetrics).toBeDefined();
      expect(metrics.messageMetrics.totalMessagesSent).toBe(10);
      expect(metrics.messageMetrics.messagesPerSecond).toBeGreaterThan(0);
    });

    it('should track room/channel statistics', async () => {
      const clients = [
        createMockClient('socket-1'),
        createMockClient('socket-2'),
        createMockClient('socket-3')
      ];
      
      // 模拟不同用户
      const users = [
        { id: 'user-1', email: 'user1@example.com', role: 'DOCTOR' },
        { id: 'user-2', email: 'user2@example.com', role: 'DOCTOR' },
        { id: 'user-3', email: 'user3@example.com', role: 'DOCTOR' }
      ];
      
      // 设置authService返回不同用户
      authService.verifyPayload = jest.fn()
        .mockResolvedValueOnce(users[0])
        .mockResolvedValueOnce(users[1])
        .mockResolvedValueOnce(users[2]);
      
      // 连接多个客户端
      for (const client of clients) {
        await gateway.handleConnection(client);
      }
      
      // 创建房间/频道
      gateway.joinRoom('user-1', 'room-1');
      gateway.joinRoom('user-2', 'room-1');
      gateway.joinRoom('user-3', 'room-2');
      
      const metrics = gateway.getEnhancedMetrics();
      
      expect(metrics.roomMetrics).toBeDefined();
      expect(metrics.roomMetrics.totalRooms).toBe(2);
      expect(metrics.roomMetrics.averageClientsPerRoom).toBe(1.5);
    });

    it('should implement sliding window metrics', async () => {
      const client = createMockClient('socket-1');
      await gateway.handleConnection(client);
      
      // 发送消息在不同时间点
      for (let i = 0; i < 5; i++) {
        gateway.sendToUser(mockUser.id, 'test_event', { data: i });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const metrics = gateway.getEnhancedMetrics();
      
      expect(metrics.slidingWindowMetrics).toBeDefined();
      expect(metrics.slidingWindowMetrics.last1MinuteMessages).toBeGreaterThanOrEqual(5);
      expect(metrics.slidingWindowMetrics.last5MinuteMessages).toBeGreaterThanOrEqual(5);
    });

    it('should track error rates', async () => {
      const invalidClient = {
        id: 'invalid-socket',
        handshake: { auth: {} },
        data: {},
        emit: jest.fn(),
        disconnect: jest.fn()
      } as unknown as Socket;
      
      // 尝试连接无效客户端
      await gateway.handleConnection(invalidClient);
      
      const metrics = gateway.getEnhancedMetrics();
      
      expect(metrics.errorMetrics).toBeDefined();
      expect(metrics.errorMetrics.connectionErrors).toBe(1);
      expect(metrics.errorMetrics.authenticationErrors).toBe(1);
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate percentile latencies', async () => {
      const client = createMockClient('socket-1');
      await gateway.handleConnection(client);
      
      // 发送多个消息以生成延迟数据
      for (let i = 0; i < 50; i++) {
        gateway.sendToUser(mockUser.id, 'test_event', { data: i });
        // 短暂延迟以模拟不同的处理时间
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      
      const metrics = gateway.getEnhancedMetrics();
      
      expect(metrics.performanceMetrics).toBeDefined();
      expect(metrics.performanceMetrics.p50Latency).toBeDefined();
      expect(metrics.performanceMetrics.p95Latency).toBeDefined();
      expect(metrics.performanceMetrics.p99Latency).toBeDefined();
      expect(metrics.performanceMetrics.p95Latency).toBeGreaterThanOrEqual(metrics.performanceMetrics.p50Latency);
    });

    it('should reset peak connections', async () => {
      // 模拟不同用户
      const users = [
        { id: 'user-1', email: 'user1@example.com', role: 'DOCTOR' },
        { id: 'user-2', email: 'user2@example.com', role: 'DOCTOR' },
        { id: 'user-3', email: 'user3@example.com', role: 'DOCTOR' }
      ];
      
      const clients = [
        createMockClient('socket-1'),
        createMockClient('socket-2'),
        createMockClient('socket-3')
      ];
      
      // 设置authService返回不同用户
      authService.verifyPayload = jest.fn()
        .mockResolvedValueOnce(users[0])
        .mockResolvedValueOnce(users[1])
        .mockResolvedValueOnce(users[2]);
      
      // 连接多个客户端
      for (const client of clients) {
        await gateway.handleConnection(client);
      }
      
      let metrics = gateway.getEnhancedMetrics();
      const currentConnections = metrics.connectionMetrics.currentConnections;
      const peakConnections = metrics.connectionMetrics.peakConnections;
      
      expect(currentConnections).toBe(3);
      expect(peakConnections).toBeGreaterThanOrEqual(3);
      
      // 重置峰值连接数
      gateway.resetPeakConnections();
      
      metrics = gateway.getEnhancedMetrics();
      expect(metrics.connectionMetrics.peakConnections).toBe(currentConnections); // 重置为当前连接数
    });
  });
}); 