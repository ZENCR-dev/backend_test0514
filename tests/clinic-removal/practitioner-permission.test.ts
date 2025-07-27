import { Test, TestingModule } from '@nestjs/testing';
import { PermissionService } from '../../src/auth/services/permission.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { UserRole } from '@prisma/client';

describe('PermissionService - Practitioner-Based Permissions', () => {
  let service: PermissionService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
            practitionerAccount: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('checkPractitionerResourceAccess', () => {
    it('should allow practitioner to access their own resources', async () => {
      // Arrange
      const user = {
        id: 'practitioner-123',
        role: UserRole.PRACTITIONER,
        // 注意：不包含 clinicId
      };

      const resourceData = {
        practitionerId: 'practitioner-123', // 资源属于该医师
        // 注意：不包含 clinicId 字段
      };

      // Act
      const result = await service.checkResourceAccess(user, 'order', resourceData);

      // Assert
      expect(result).toBe(true);
    });

    it('should deny practitioner access to other practitioners resources', async () => {
      // Arrange
      const user = {
        id: 'practitioner-123',
        role: UserRole.PRACTITIONER,
      };

      const resourceData = {
        practitionerId: 'practitioner-456', // 资源属于其他医师
      };

      // Act
      const result = await service.checkResourceAccess(user, 'order', resourceData);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle admin access without clinic dependency', async () => {
      // Arrange
      const adminUser = {
        id: 'admin-123',
        role: UserRole.ADMIN,
        // 管理员不需要 clinicId
      };

      const resourceData = {
        practitionerId: 'practitioner-456',
      };

      // Act
      const result = await service.checkResourceAccess(adminUser, 'order', resourceData);

      // Assert
      expect(result).toBe(true); // 管理员可以访问所有资源
    });

    it('should validate practitioner account exists', async () => {
      // Arrange
      const user = {
        id: 'practitioner-123',
        role: UserRole.PRACTITIONER,
      };

      const mockPractitionerAccount = {
        id: 'account-123',
        practitionerId: 'practitioner-123',
        status: 'active',
      };

      (prisma.practitionerAccount.findUnique as jest.Mock).mockResolvedValue(
        mockPractitionerAccount
      );

      // Act
      const result = await service.validatePractitionerAccount(user.id);

      // Assert
      expect(result).toBe(true);
      expect(prisma.practitionerAccount.findUnique).toHaveBeenCalledWith({
        where: { practitionerId: user.id },
      });
    });

    it('should deny access for inactive practitioner account', async () => {
      // Arrange
      const user = {
        id: 'practitioner-123',
        role: UserRole.PRACTITIONER,
      };

      const mockInactivePractitionerAccount = {
        id: 'account-123',
        practitionerId: 'practitioner-123',
        status: 'inactive',
      };

      (prisma.practitionerAccount.findUnique as jest.Mock).mockResolvedValue(
        mockInactivePractitionerAccount
      );

      // Act
      const result = await service.validatePractitionerAccount(user.id);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('checkOrderPermissions', () => {
    it('should allow practitioner to create order without clinic validation', async () => {
      // Arrange
      const practitioner = {
        id: 'practitioner-123',
        role: UserRole.PRACTITIONER,
      };

      const orderData = {
        practitionerId: 'practitioner-123',
        // 注意：不需要 clinicId 验证
        patientInfo: { name: '测试患者' },
        totalAmount: 100.00,
      };

      // Act
      const result = await service.checkOrderPermissions(practitioner, orderData);

      // Assert
      expect(result).toBe(true);
    });

    it('should deny practitioner creating order for other practitioner', async () => {
      // Arrange
      const practitioner = {
        id: 'practitioner-123',
        role: UserRole.PRACTITIONER,
      };

      const orderData = {
        practitionerId: 'practitioner-456', // 不同的医师ID
        patientInfo: { name: '测试患者' },
        totalAmount: 100.00,
      };

      // Act
      const result = await service.checkOrderPermissions(practitioner, orderData);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('checkPaymentPermissions', () => {
    it('should allow practitioner to pay from their own account', async () => {
      // Arrange
      const practitioner = {
        id: 'practitioner-123',
        role: UserRole.PRACTITIONER,
      };

      const paymentData = {
        practitionerId: 'practitioner-123',
        amount: 100.00,
        // 注意：基于个人账户，不需要 clinicId
      };

      // Act
      const result = await service.checkPaymentPermissions(practitioner, paymentData);

      // Assert
      expect(result).toBe(true);
    });

    it('should deny practitioner using other practitioners account', async () => {
      // Arrange
      const practitioner = {
        id: 'practitioner-123',
        role: UserRole.PRACTITIONER,
      };

      const paymentData = {
        practitionerId: 'practitioner-456', // 不同的医师账户
        amount: 100.00,
      };

      // Act
      const result = await service.checkPaymentPermissions(practitioner, paymentData);

      // Assert
      expect(result).toBe(false);
    });
  });
}); 