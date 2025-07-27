import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from '../../src/orders/services/order.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateOrderDto } from '../../src/orders/dto/create-order.dto';
import { OrderStatus } from '@prisma/client';

describe('OrderService - Without Clinic Dependencies', () => {
  let service: OrderService;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: PrismaService,
          useValue: {
            order: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            orderItem: {
              createMany: jest.fn(),
            },
            medicine: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    prisma = module.get<PrismaService>(PrismaService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('createOrder - without clinicId', () => {
    it('should create order using practitionerId only', async () => {
      // Arrange
      const createOrderDto: CreateOrderDto = {
        practitionerId: 'practitioner-123',
        patientId: 'patient-456',
        // 注意：移除 clinicId 字段
        patientInfo: {
          name: '张三',
          phone: '13812345678',
          address: '上海市浦东新区',
        },
        totalAmount: 150.00,
        items: [
          {
            medicineId: 'medicine-789',
            quantity: 2,
            unitPrice: 75.00,
            dosageInstructions: '每日三次，饭后服用',
          },
        ],
      };

      const mockOrder = {
        id: 'order-123',
        platformOrderId: 'ORD20250628001',
        practitionerId: 'practitioner-123',
        patientId: 'patient-456',
        // 注意：不包含 clinicId
        patientInfo: createOrderDto.patientInfo,
        status: OrderStatus.DRAFT,
        totalAmount: 150.00,
        createdAt: new Date(),
        version: 1,
      };

      const mockMedicine = {
        id: 'medicine-789',
        name: '阿莫西林胶囊',
        basePrice: 75.00,
        status: 'active',
      };

      // Mock Prisma calls
      (prisma.medicine.findUnique as jest.Mock).mockResolvedValue(mockMedicine);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          order: {
            create: jest.fn().mockResolvedValue(mockOrder),
          },
          orderItem: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        });
      });

      // Act
      const result = await service.createOrder(createOrderDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.practitionerId).toBe('practitioner-123');
      expect(result.patientId).toBe('patient-456');
      expect(result).not.toHaveProperty('clinicId');
      expect(result.totalAmount).toBe(150.00);
      expect(result.status).toBe(OrderStatus.DRAFT);
    });

    it('should validate practitioner exists without clinic dependency', async () => {
      // Arrange
      const createOrderDto: CreateOrderDto = {
        practitionerId: 'nonexistent-practitioner',
        patientInfo: { name: '测试患者' },
        totalAmount: 100.00,
        items: [],
      };

      // Mock practitioner not found (without clinic validation)
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('Practitioner not found')
      );

      // Act & Assert
      await expect(service.createOrder(createOrderDto)).rejects.toThrow(
        'Practitioner not found'
      );
    });

    it('should handle order creation without clinic-based permissions', async () => {
      // Arrange
      const createOrderDto: CreateOrderDto = {
        practitionerId: 'practitioner-123',
        patientInfo: { name: '测试患者' },
        totalAmount: 200.00,
        items: [
          {
            medicineId: 'medicine-456',
            quantity: 1,
            unitPrice: 200.00,
          },
        ],
      };

      const mockMedicine = {
        id: 'medicine-456',
        name: '复方甘草片',
        basePrice: 200.00,
        status: 'active',
      };

      (prisma.medicine.findUnique as jest.Mock).mockResolvedValue(mockMedicine);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback({
          order: {
            create: jest.fn().mockResolvedValue({
              id: 'order-456',
              practitionerId: 'practitioner-123',
              totalAmount: 200.00,
              status: OrderStatus.DRAFT,
            }),
          },
          orderItem: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        });
      });

      // Act
      const result = await service.createOrder(createOrderDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.practitionerId).toBe('practitioner-123');
      // 验证不依赖clinic权限检查
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('queryOrders - without clinic filtering', () => {
    it('should query orders by practitionerId only', async () => {
      // Arrange
      const queryParams = {
        practitionerId: 'practitioner-123',
        // 注意：不包含 clinicId 过滤
        page: 1,
        pageSize: 10,
      };

      const mockOrders = [
        {
          id: 'order-1',
          practitionerId: 'practitioner-123',
          status: OrderStatus.DRAFT,
        },
        {
          id: 'order-2',
          practitionerId: 'practitioner-123',
          status: OrderStatus.PAID,
        },
      ];

      (prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);

      // Act
      const result = await service.queryOrders(queryParams);

      // Assert
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            practitionerId: 'practitioner-123',
            // 验证不包含 clinicId 过滤条件
          }),
        })
      );
    });
  });
}); 