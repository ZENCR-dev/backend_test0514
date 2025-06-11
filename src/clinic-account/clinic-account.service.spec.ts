import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClinicAccountService } from './services/clinic-account.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClinicAccountDto } from './dto/create-clinic-account.dto';
import { AccountStatus } from '@prisma/client';
import { UpdateClinicAccountDto } from './dto/update-clinic-account.dto';
import { QueryClinicAccountDto } from './dto/query-clinic-account.dto';

describe('ClinicAccountService', () => {
  let service: ClinicAccountService;
  let prismaService: PrismaService;

  const mockAccount = {
    id: 'test-account-id',
    clinicId: 'test-clinic-id',
    balance: 1000,
    creditLimit: 5000,
    status: AccountStatus.active,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    clinic: { name: '测试诊所' }, // 模拟关联的clinic数据
  };

  const mockPrismaService = {
    clinicAccount: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    userProfile: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicAccountService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ClinicAccountService>(ClinicAccountService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateClinicAccountDto = {
      clinicId: 'test-clinic-id',
      initialPrepaidAmount: 1000,
      creditLimit: 5000,
      status: AccountStatus.active,
    };

    it('应该成功创建诊所账户', async () => {
      mockPrismaService.clinicAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.clinicAccount.create.mockResolvedValue(mockAccount);

      const result = await service.create(createDto);

      expect(mockPrismaService.clinicAccount.findFirst).toHaveBeenCalledWith({
        where: {
          clinicId: createDto.clinicId,
          status: {
            not: AccountStatus.frozen,
          },
        },
      });

      expect(mockPrismaService.clinicAccount.create).toHaveBeenCalledWith({
        data: {
          clinicId: createDto.clinicId,
          balance: createDto.initialPrepaidAmount,
          creditLimit: createDto.creditLimit,
          status: createDto.status,
          version: 1,
        },
        include: {
          clinic: true,
        },
      });

      expect(result.id).toBe(mockAccount.id);
      expect(result.clinicName).toBe('测试诊所');
    });

    it('当诊所已存在账户时应该抛出错误', async () => {
      mockPrismaService.clinicAccount.findFirst.mockResolvedValue(mockAccount);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.clinicAccount.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const queryDto: QueryClinicAccountDto = {
      page: 1,
      limit: 10,
      search: '测试',
      status: AccountStatus.active,
    };

    it('应该返回分页的诊所账户列表', async () => {
      const mockAccounts = [mockAccount];
      const mockTotal = 1;

      mockPrismaService.clinicAccount.findMany.mockResolvedValue(mockAccounts);
      mockPrismaService.clinicAccount.count.mockResolvedValue(mockTotal);

      const result = await service.findAll(queryDto);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(mockTotal);
      expect(result.meta.page).toBe(queryDto.page);
      expect(result.meta.limit).toBe(queryDto.limit);
      expect(result.meta.totalPages).toBe(1);
    });

    it('应该支持搜索功能', async () => {
      mockPrismaService.clinicAccount.findMany.mockResolvedValue([]);
      mockPrismaService.clinicAccount.count.mockResolvedValue(0);

      await service.findAll(queryDto);

      expect(mockPrismaService.clinicAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: queryDto.status,
            clinic: {
              name: {
                contains: queryDto.search,
                mode: 'insensitive',
              },
            },
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('应该返回指定的诊所账户', async () => {
      mockPrismaService.clinicAccount.findFirst.mockResolvedValue(mockAccount);

      const result = await service.findOne(mockAccount.id);

      expect(mockPrismaService.clinicAccount.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockAccount.id,
          status: {
            not: AccountStatus.frozen,
          },
        },
        include: {
          clinic: true,
        },
      });

      expect(result.id).toBe(mockAccount.id);
    });

    it('当账户不存在时应该抛出NotFoundException', async () => {
      mockPrismaService.clinicAccount.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateClinicAccountDto = {
      creditLimit: 10000,
    };

    it('应该成功更新诊所账户', async () => {
      const updatedAccount = { ...mockAccount, ...updateDto };
      
      mockPrismaService.clinicAccount.findFirst.mockResolvedValue(mockAccount);
      mockPrismaService.clinicAccount.update.mockResolvedValue(updatedAccount);

      const result = await service.update(mockAccount.id, updateDto);

      expect(mockPrismaService.clinicAccount.update).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
        data: {
          ...updateDto,
          updatedAt: expect.any(Date),
        },
        include: {
          clinic: true,
        },
      });

      expect(result.creditLimit).toBe(updateDto.creditLimit);
    });
  });

  describe('remove', () => {
    it('应该成功软删除诊所账户', async () => {
      mockPrismaService.clinicAccount.findFirst.mockResolvedValue(mockAccount);
      mockPrismaService.clinicAccount.update.mockResolvedValue({
        ...mockAccount,
        status: AccountStatus.frozen,
      });

      const result = await service.remove(mockAccount.id);

      expect(mockPrismaService.clinicAccount.update).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
        data: {
          status: AccountStatus.frozen,
          updatedAt: expect.any(Date),
        },
      });

      expect(result.message).toBe('诊所账户删除成功');
    });
  });

  describe('getBalance', () => {
    it('应该返回账户余额信息', async () => {
      mockPrismaService.clinicAccount.findFirst.mockResolvedValue(mockAccount);

      const result = await service.getBalance(mockAccount.id);

      expect(result.accountId).toBe(mockAccount.id);
      expect(result.prepaidBalance).toBe(1000);
      expect(result.creditLimit).toBe(5000);
      expect(result.availableBalance).toBe(6000);
    });
  });

  describe('checkAccountAccess', () => {
    it('admin应该能访问所有账户', async () => {
      const result = await service.checkAccountAccess('any-account-id', 'user-id', 'admin');
      expect(result).toBe(true);
    });

    it('practitioner应该只能访问自己诊所的账户', async () => {
      const mockAccountWithClinic = { 
        ...mockAccount, 
        clinic: { ownerId: 'user-id' } 
      };
      
      mockPrismaService.clinicAccount.findUnique.mockResolvedValue(mockAccountWithClinic);

      const result = await service.checkAccountAccess(mockAccount.id, 'user-id', 'practitioner');
      expect(result).toBe(true);
    });

    it('practitioner不应该能访问其他诊所的账户', async () => {
      const mockAccountWithClinic = { 
        ...mockAccount, 
        clinic: { ownerId: 'other-user-id' } 
      };
      
      mockPrismaService.clinicAccount.findUnique.mockResolvedValue(mockAccountWithClinic);

      const result = await service.checkAccountAccess(mockAccount.id, 'user-id', 'practitioner');
      expect(result).toBe(false);
    });
  });
}); 