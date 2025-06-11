import { Test, TestingModule } from '@nestjs/testing';
import { ClinicAccountController } from './clinic-account.controller';
import { ClinicAccountService } from './services/clinic-account.service';
import { CreateClinicAccountDto } from './dto/create-clinic-account.dto';
import { AccountStatus } from '@prisma/client';
import { UpdateClinicAccountDto } from './dto/update-clinic-account.dto';
import { QueryClinicAccountDto } from './dto/query-clinic-account.dto';
import { PermissionService } from '../auth/services/permission.service';
import { Reflector } from '@nestjs/core';

describe('ClinicAccountController', () => {
  let controller: ClinicAccountController;
  let service: ClinicAccountService;

  const mockClinicAccountService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getBalance: jest.fn(),
  };

  const mockPermissionService = {
    checkPermission: jest.fn().mockResolvedValue(true),
  };

  const mockAccount = {
    id: 'test-account-id',
    clinicName: '测试诊所', // This will be sourced from the clinic relation
    clinicId: 'test-clinic-id',
    prepaidBalance: 1000,
    creditLimit: 5000,
    availableBalance: 6000,
    status: AccountStatus.active,
    version: 1,
    notes: '测试账户',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    sub: 'user-id',
    role: 'admin',
    email: 'admin@example.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClinicAccountController],
      providers: [
        {
          provide: ClinicAccountService,
          useValue: mockClinicAccountService,
        },
        {
          provide: PermissionService,
          useValue: mockPermissionService,
        },
        Reflector, // Reflector is often needed by guards
      ],
    }).compile();

    controller = module.get<ClinicAccountController>(ClinicAccountController);
    service = module.get<ClinicAccountService>(ClinicAccountService);
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
      mockClinicAccountService.create.mockResolvedValue(mockAccount);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockAccount);
    });
  });

  describe('findAll', () => {
    const queryDto: QueryClinicAccountDto = {
      page: 1,
      limit: 10,
      search: '测试',
      status: AccountStatus.active,
    };

    const mockListResponse = {
      data: [mockAccount],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    };

    it('应该返回诊所账户列表', async () => {
      mockClinicAccountService.findAll.mockResolvedValue(mockListResponse);

      const req = { user: mockUser };
      const result = await controller.findAll(queryDto, req);

      expect(service.findAll).toHaveBeenCalledWith(queryDto, mockUser.sub, mockUser.role);
      expect(result).toEqual(mockListResponse);
    });
  });

  describe('findOne', () => {
    it('应该返回指定的诊所账户', async () => {
      mockClinicAccountService.findOne.mockResolvedValue(mockAccount);

      const result = await controller.findOne(mockAccount.id);

      expect(service.findOne).toHaveBeenCalledWith(mockAccount.id);
      expect(result).toEqual(mockAccount);
    });
  });

  describe('update', () => {
    const updateDto: UpdateClinicAccountDto = {
      creditLimit: 10000,
    };

    it('应该成功更新诊所账户', async () => {
      const updatedAccount = { ...mockAccount, ...updateDto };
      mockClinicAccountService.update.mockResolvedValue(updatedAccount);

      const result = await controller.update(mockAccount.id, updateDto);

      expect(service.update).toHaveBeenCalledWith(mockAccount.id, updateDto);
      expect(result).toEqual(updatedAccount);
    });
  });

  describe('remove', () => {
    it('应该成功删除诊所账户', async () => {
      const mockResponse = { message: '诊所账户删除成功' };
      mockClinicAccountService.remove.mockResolvedValue(mockResponse);

      const result = await controller.remove(mockAccount.id);

      expect(service.remove).toHaveBeenCalledWith(mockAccount.id);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getBalance', () => {
    const mockBalanceResponse = {
      accountId: mockAccount.id,
      prepaidBalance: mockAccount.prepaidBalance,
      creditLimit: mockAccount.creditLimit,
      availableBalance: mockAccount.availableBalance,
      status: mockAccount.status,
      queriedAt: new Date(),
    };

    it('应该返回账户余额信息', async () => {
      mockClinicAccountService.getBalance.mockResolvedValue(mockBalanceResponse);

      const req = { user: mockUser };
      const result = await controller.getBalance(mockAccount.id, req);

      expect(service.getBalance).toHaveBeenCalledWith(mockAccount.id, mockUser.sub, mockUser.role);
      expect(result).toEqual(mockBalanceResponse);
    });
  });
}); 