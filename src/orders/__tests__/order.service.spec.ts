import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from '../services/order.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { ICreateOrderRequest, IUpdateOrderStatusRequest, IOrderQueryCriteria } from '../interfaces/order-management.interface';

describe('OrderService', () => {
  let service: OrderService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    orderItem: {
      createMany: jest.fn(),
    },
    medicine: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    clinic: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    const mockCreateOrderRequest: ICreateOrderRequest = {
      practitionerId: 'practitioner-1',
      clinicId: 'clinic-1',
      patientInfo: { name: '张三', phone: '021-12345678' },
      totalAmount: 125.50,
      items: [
        {
          medicineId: 'medicine-1',
          quantity: 10,
          unitPrice: 12.55,
          dosageInstructions: '每日三次',
        },
      ],
      idempotencyKey: 'test-key-123',
    };

    it('should create order successfully', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-1',
        platformOrderId: 'ORD20250614001',
        ...mockCreateOrderRequest,
        status: OrderStatus.DRAFT,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'practitioner-1' });
      mockPrismaService.clinic.findUnique.mockResolvedValue({ id: 'clinic-1' });
      mockPrismaService.medicine.findUnique.mockResolvedValue({ id: 'medicine-1', basePrice: 12.55 });
      mockPrismaService.$transaction.mockResolvedValue(mockOrder);

      // Act
      const result = await service.createOrder(mockCreateOrderRequest);

      // Assert
      expect(result).toEqual(mockOrder);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid practitioner', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createOrder(mockCreateOrderRequest)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid clinic', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'practitioner-1' });
      mockPrismaService.clinic.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createOrder(mockCreateOrderRequest)).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException for duplicate idempotency key', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'practitioner-1' });
      mockPrismaService.clinic.findUnique.mockResolvedValue({ id: 'clinic-1' });
      mockPrismaService.order.findUnique.mockResolvedValue({ id: 'existing-order' });

      // Act & Assert
      await expect(service.createOrder(mockCreateOrderRequest)).rejects.toThrow(ConflictException);
    });
  });

  describe('updateOrderStatus', () => {
    const mockUpdateRequest: IUpdateOrderStatusRequest = {
      status: OrderStatus.CANCELLED,
      notes: '客户取消',
      version: 1,
    };

    it('should update order status successfully', async () => {
      // Arrange
      const mockExistingOrder = {
        id: 'order-1',
        status: OrderStatus.DRAFT,
        version: 1,
      };
      const mockUpdatedOrder = {
        ...mockExistingOrder,
        status: OrderStatus.CANCELLED,
        notes: '客户取消',
        version: 2,
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockExistingOrder);
      mockPrismaService.order.update.mockResolvedValue(mockUpdatedOrder);

      // Act
      const result = await service.updateOrderStatus('order-1', mockUpdateRequest);

      // Assert
      expect(result).toEqual(mockUpdatedOrder);
      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1', version: 1 },
        data: {
          status: OrderStatus.CANCELLED,
          notes: '客户取消',
          version: { increment: 1 },
        },
      });
    });

    it('should throw NotFoundException for non-existent order', async () => {
      // Arrange
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateOrderStatus('order-1', mockUpdateRequest)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      // Arrange
      const mockExistingOrder = {
        id: 'order-1',
        status: OrderStatus.FULFILLED,
        version: 1,
      };
      mockPrismaService.order.findUnique.mockResolvedValue(mockExistingOrder);

      // Act & Assert
      await expect(service.updateOrderStatus('order-1', {
        status: OrderStatus.DRAFT,
        version: 1,
      })).rejects.toThrow(BadRequestException);
    });
  });

  describe('getOrderById', () => {
    it('should return order by id', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-1',
        platformOrderId: 'ORD20250614001',
        status: OrderStatus.DRAFT,
      };
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      // Act
      const result = await service.getOrderById('order-1');

      // Assert
      expect(result).toEqual(mockOrder);
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        include: { items: true },
      });
    });

    it('should throw NotFoundException for non-existent order', async () => {
      // Arrange
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getOrderById('order-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('queryOrders', () => {
    const mockQueryCriteria: IOrderQueryCriteria = {
      practitionerId: 'practitioner-1',
      status: OrderStatus.DRAFT,
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };

    it('should return paginated orders', async () => {
      // Arrange
      const mockOrders = [
        { id: 'order-1', status: OrderStatus.DRAFT },
        { id: 'order-2', status: OrderStatus.DRAFT },
      ];
      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);
      mockPrismaService.order.count.mockResolvedValue(2);

      // Act
      const result = await service.queryOrders(mockQueryCriteria);

      // Assert
      expect(result).toEqual({
        data: mockOrders,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });
  });

  describe('isStatusTransitionAllowed', () => {
    it('should allow DRAFT to CANCELLED transition', () => {
      expect(service.isStatusTransitionAllowed(OrderStatus.DRAFT, OrderStatus.CANCELLED)).toBe(true);
    });

    it('should allow DRAFT to PAID transition', () => {
      expect(service.isStatusTransitionAllowed(OrderStatus.DRAFT, OrderStatus.PAID)).toBe(true);
    });

    it('should not allow FULFILLED to DRAFT transition', () => {
      expect(service.isStatusTransitionAllowed(OrderStatus.FULFILLED, OrderStatus.DRAFT)).toBe(false);
    });

    it('should not allow CANCELLED to PAID transition', () => {
      expect(service.isStatusTransitionAllowed(OrderStatus.CANCELLED, OrderStatus.PAID)).toBe(false);
    });
  });

  describe('validateOrderData', () => {
    it('should validate order data successfully', async () => {
      // Arrange
      const mockOrderData: ICreateOrderRequest = {
        practitionerId: 'practitioner-1',
        clinicId: 'clinic-1',
        patientInfo: { name: '张三' },
        totalAmount: 125.50,
        items: [
          {
            medicineId: 'medicine-1',
            quantity: 10,
            unitPrice: 12.55,
          },
        ],
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'practitioner-1' });
      mockPrismaService.clinic.findUnique.mockResolvedValue({ id: 'clinic-1' });
      mockPrismaService.medicine.findUnique.mockResolvedValue({ id: 'medicine-1' });

      // Act
      const result = await service.validateOrderData(mockOrderData);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for invalid total amount calculation', async () => {
      // Arrange
      const mockOrderData: ICreateOrderRequest = {
        practitionerId: 'practitioner-1',
        clinicId: 'clinic-1',
        patientInfo: { name: '张三' },
        totalAmount: 100.00, // 错误的总金额
        items: [
          {
            medicineId: 'medicine-1',
            quantity: 10,
            unitPrice: 12.55, // 实际应该是 125.50
          },
        ],
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'practitioner-1' });
      mockPrismaService.clinic.findUnique.mockResolvedValue({ id: 'clinic-1' });
      mockPrismaService.medicine.findUnique.mockResolvedValue({ id: 'medicine-1' });

      // Act
      const result = await service.validateOrderData(mockOrderData);

      // Assert
      expect(result).toBe(false);
    });
  });
}); 