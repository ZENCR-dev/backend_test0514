import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../../auth/auth.service';
import { OrchestrationGateway } from '../orchestration.gateway';
import { Socket } from 'socket.io';
import { UnauthorizedException } from '@nestjs/common';

describe('OrchestrationGateway', () => {
  let gateway: OrchestrationGateway;
  let jwtService: JwtService;
  let authService: AuthService;

  // 模拟数据
  const mockUser = { id: 'user-123', email: 'test@example.com', role: 'DOCTOR' };
  const mockToken = 'valid.jwt.token';
  const mockPayload = { sub: 'user-123', email: 'test@example.com' };

  // 模拟Socket客户端
  const mockClient = {
    id: 'socket-123',
    handshake: {
      auth: {
        token: mockToken
      }
    },
    data: {},
    emit: jest.fn(),
    disconnect: jest.fn()
  } as unknown as Socket;

  // 模拟Socket服务器
  const mockServer = {
    emit: jest.fn(),
    engine: {
      clientsCount: 1
    }
  };

  beforeEach(async () => {
    // 创建测试模块
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

    // 模拟WebSocketServer
    gateway.server = mockServer as any;

    // 清除所有模拟函数的调用历史
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should authenticate client with valid token', async () => {
      // 调用方法
      await gateway.handleConnection(mockClient);

      // 验证JWT验证被调用
      expect(jwtService.verify).toHaveBeenCalledWith(mockToken);
      
      // 验证用户验证被调用
      expect(authService.verifyPayload).toHaveBeenCalledWith(mockPayload);
      
      // 验证用户数据被存储
      expect(mockClient.data.user).toEqual(mockUser);
      
      // 验证连接状态事件被发送
      expect(mockClient.emit).toHaveBeenCalledWith(
        'connection_status',
        expect.objectContaining({
          connected: true,
          userId: mockUser.id
        })
      );
    });

    it('should reject connection with missing token', async () => {
      // 创建无token的客户端
      const clientWithoutToken = {
        ...mockClient,
        handshake: { auth: {} }
      } as unknown as Socket;

      // 调用方法
      await gateway.handleConnection(clientWithoutToken);

      // 验证错误事件被发送
      expect(clientWithoutToken.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Authentication failed',
          code: expect.any(String)
        })
      );
      
      // 验证连接被断开
      expect(clientWithoutToken.disconnect).toHaveBeenCalled();
    });

    it('should reject connection with invalid token', async () => {
      // 模拟JWT验证失败
      (jwtService.verify as jest.Mock).mockImplementationOnce(() => {
        throw new UnauthorizedException('Invalid token');
      });

      // 调用方法
      await gateway.handleConnection(mockClient);

      // 验证错误事件被发送
      expect(mockClient.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Authentication failed',
          code: expect.any(String)
        })
      );
      
      // 验证连接被断开
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should disconnect previous connection from same user', async () => {
      // 创建第一个连接
      const firstClient = {
        ...mockClient,
        id: 'socket-1'
      } as unknown as Socket;
      
      await gateway.handleConnection(firstClient);
      
      // 创建第二个连接（同一用户）
      const secondClient = {
        ...mockClient,
        id: 'socket-2'
      } as unknown as Socket;
      
      // 调用方法
      await gateway.handleConnection(secondClient);
      
      // 验证第一个连接被断开
      expect(firstClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should handle authenticated client disconnect', () => {
      // 设置客户端数据
      const clientWithUser = {
        ...mockClient,
        data: { user: mockUser }
      } as unknown as Socket;
      
      // 先连接
      gateway.handleConnection(clientWithUser);
      
      // 然后断开
      gateway.handleDisconnect(clientWithUser);
      
      // 验证客户端被移除（间接验证：再次连接不会断开旧连接）
      const newClient = {
        ...mockClient,
        id: 'new-socket',
        data: {}
      } as unknown as Socket;
      
      gateway.handleConnection(newClient);
      expect(clientWithUser.disconnect).not.toHaveBeenCalled();
    });

    it('should handle unauthenticated client disconnect', () => {
      // 创建无用户数据的客户端
      const clientWithoutUser = {
        ...mockClient,
        data: {}
      } as unknown as Socket;
      
      // 直接断开（没有先连接）
      expect(() => gateway.handleDisconnect(clientWithoutUser)).not.toThrow();
    });
  });

  describe('broadcastEvent', () => {
    it('should broadcast event to all clients', () => {
      // 事件数据
      const eventName = 'test_event';
      const eventData = { message: 'Test message' };
      
      // 调用方法
      gateway.broadcastEvent(eventName, eventData);
      
      // 验证服务器广播
      expect(mockServer.emit).toHaveBeenCalledWith(eventName, eventData);
    });
  });

  describe('sendToUser', () => {
    it('should send event to specific user', async () => {
      // 先连接用户
      await gateway.handleConnection(mockClient);
      
      // 事件数据
      const eventName = 'test_event';
      const eventData = { message: 'Test message' };
      
      // 调用方法
      const result = gateway.sendToUser(mockUser.id, eventName, eventData);
      
      // 验证事件发送
      expect(mockClient.emit).toHaveBeenCalledWith(eventName, eventData);
      expect(result).toBe(true);
    });

    it('should return false when user not connected', () => {
      // 事件数据
      const eventName = 'test_event';
      const eventData = { message: 'Test message' };
      
      // 调用方法（没有先连接用户）
      const result = gateway.sendToUser('non-existent-user', eventName, eventData);
      
      // 验证结果
      expect(result).toBe(false);
    });
  });

  describe('getMetrics', () => {
    it('should return gateway metrics', async () => {
      // 先连接一个用户
      await gateway.handleConnection(mockClient);
      
      // 获取指标
      const metrics = gateway.getMetrics();
      
      // 验证指标数据
      expect(metrics).toHaveProperty('activeConnections');
      expect(metrics).toHaveProperty('totalConnectionAttempts');
      expect(metrics).toHaveProperty('totalEvents');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('timestamp');
    });
  });

  describe('isHealthy', () => {
    it('should return true when server is healthy', () => {
      const result = gateway.isHealthy();
      expect(result).toBe(true);
    });

    it('should return false when server is not available', () => {
      // 模拟服务器不可用
      gateway.server = undefined as any;
      
      const result = gateway.isHealthy();
      expect(result).toBe(false);
    });
  });
}); 