import { Test, TestingModule } from '@nestjs/testing';
import { OrchestrationGateway } from '../../src/orchestration/gateways/orchestration.gateway';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { UserRole } from '@prisma/client';

describe('OrchestrationGateway - Without Clinic Dependencies', () => {
  let gateway: OrchestrationGateway;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationGateway,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<OrchestrationGateway>(OrchestrationGateway);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('handleConnection - practitioner-based authentication', () => {
    it('should authenticate practitioner without clinic validation', async () => {
      // Arrange
      const mockSocket = {
        handshake: {
          auth: {
            token: 'valid-jwt-token',
          },
        },
        join: jest.fn(),
        emit: jest.fn(),
        disconnect: jest.fn(),
        id: 'socket-123',
      } as unknown as Socket;

      const mockTokenPayload = {
        sub: 'practitioner-123',
        role: UserRole.PRACTITIONER,
        // 注意：不包含 clinicId
      };

      (jwtService.verify as jest.Mock).mockReturnValue(mockTokenPayload);

      // Act
      await gateway.handleConnection(mockSocket);

      // Assert
      expect(jwtService.verify).toHaveBeenCalledWith('valid-jwt-token');
      expect(mockSocket.join).toHaveBeenCalledWith('practitioner-123');
      // 验证不加入clinic room
      expect(mockSocket.join).not.toHaveBeenCalledWith(
        expect.stringContaining('clinic-')
      );
    });

    it('should reject connection with invalid token', async () => {
      // Arrange
      const mockSocket = {
        handshake: {
          auth: {
            token: 'invalid-token',
          },
        },
        disconnect: jest.fn(),
        emit: jest.fn(),
        id: 'socket-456',
      } as unknown as Socket;

      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      await gateway.handleConnection(mockSocket);

      // Assert
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should handle admin connection without clinic room', async () => {
      // Arrange
      const mockSocket = {
        handshake: {
          auth: {
            token: 'admin-token',
          },
        },
        join: jest.fn(),
        emit: jest.fn(),
        id: 'socket-admin',
      } as unknown as Socket;

      const mockAdminPayload = {
        sub: 'admin-123',
        role: UserRole.ADMIN,
        // 管理员不需要 clinicId
      };

      (jwtService.verify as jest.Mock).mockReturnValue(mockAdminPayload);

      // Act
      await gateway.handleConnection(mockSocket);

      // Assert
      expect(mockSocket.join).toHaveBeenCalledWith('admin-123');
      expect(mockSocket.join).toHaveBeenCalledWith('admin-global');
    });
  });

  describe('broadcastToPractitioner', () => {
    it('should send message to specific practitioner room', async () => {
      // Arrange
      const practitionerId = 'practitioner-123';
      const message = {
        type: 'order_update',
        data: {
          orderId: 'order-456',
          status: 'paid',
        },
      };

      // Mock server.to method
      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      gateway.server = mockServer as any;

      // Act
      gateway.broadcastToPractitioner(practitionerId, message);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith(practitionerId);
      expect(mockServer.emit).toHaveBeenCalledWith('message', message);
    });

    it('should not broadcast to clinic rooms', async () => {
      // Arrange
      const practitionerId = 'practitioner-123';
      const message = { type: 'test', data: {} };

      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      gateway.server = mockServer as any;

      // Act
      gateway.broadcastToPractitioner(practitionerId, message);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith(practitionerId);
      // 验证不向clinic room广播
      expect(mockServer.to).not.toHaveBeenCalledWith(
        expect.stringContaining('clinic-')
      );
    });
  });

  describe('handleOrderStatusUpdate', () => {
    it('should notify practitioner directly without clinic broadcast', async () => {
      // Arrange
      const orderUpdateData = {
        orderId: 'order-123',
        practitionerId: 'practitioner-456',
        // 注意：不包含 clinicId
        status: 'completed',
        updatedAt: new Date(),
      };

      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      gateway.server = mockServer as any;

      // Act
      await gateway.handleOrderStatusUpdate(orderUpdateData);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith('practitioner-456');
      expect(mockServer.emit).toHaveBeenCalledWith('order_status_update', {
        orderId: 'order-123',
        status: 'completed',
        updatedAt: orderUpdateData.updatedAt,
      });
    });

    it('should handle payment notifications to practitioner', async () => {
      // Arrange
      const paymentData = {
        practitionerId: 'practitioner-789',
        amount: 150.00,
        // 注意：基于个人账户，不包含 clinicId
        transactionId: 'txn-123',
        status: 'success',
      };

      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      gateway.server = mockServer as any;

      // Act
      await gateway.handlePaymentNotification(paymentData);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith('practitioner-789');
      expect(mockServer.emit).toHaveBeenCalledWith('payment_notification', {
        amount: 150.00,
        transactionId: 'txn-123',
        status: 'success',
      });
    });
  });

  describe('handleDisconnect', () => {
    it('should clean up practitioner connection without clinic room cleanup', async () => {
      // Arrange
      const mockSocket = {
        id: 'socket-123',
        leave: jest.fn(),
        rooms: new Set(['practitioner-456']),
      } as unknown as Socket;

      // Act
      await gateway.handleDisconnect(mockSocket);

      // Assert
      expect(mockSocket.leave).toHaveBeenCalledWith('practitioner-456');
      // 验证不清理clinic rooms
      expect(mockSocket.leave).not.toHaveBeenCalledWith(
        expect.stringContaining('clinic-')
      );
    });
  });

  describe('broadcastToAllPractitioners', () => {
    it('should send system-wide message to all practitioners', async () => {
      // Arrange
      const systemMessage = {
        type: 'system_maintenance',
        data: {
          message: '系统将于今晚进行维护',
          scheduledTime: '2025-06-28T22:00:00Z',
        },
      };

      const mockServer = {
        emit: jest.fn(),
      };
      gateway.server = mockServer as any;

      // Act
      gateway.broadcastToAllPractitioners(systemMessage);

      // Assert
      expect(mockServer.emit).toHaveBeenCalledWith('system_message', systemMessage);
    });
  });
}); 