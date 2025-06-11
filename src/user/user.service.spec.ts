import { Test, TestingModule } from "@nestjs/testing";
import { UserService } from "./user.service";
import { PrismaService } from "../prisma/prisma.service";
import { UserRole, UserStatus } from "@prisma/client";

describe("UserService", () => {
  let service: UserService;
  let prismaService: PrismaService;

  const mockUser = {
    id: "1",
    email: "test@example.com",
    password: "hashedPassword",
    role: UserRole.practitioner,
    status: UserStatus.pending,
    referralCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: {
      id: "1",
      userId: "1",
      fullName: "Test User",
      phone: "123456789",
      licenseNumber: "LIC123",
      address: '{"street": "123 Test St", "city": "Test City"}',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockPrismaService = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    const createUserDto = {
      email: "newuser@example.com",
      password: "hashedPassword",
      role: UserRole.practitioner,
      fullName: "New User",
      phone: "987654321",
      licenseNumber: "LIC456",
      address: '{"street": "456 New St", "city": "New City"}',
      referralCode: "REF123",
    };

    it("should create a new user with profile", async () => {
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: createUserDto.email,
          role: createUserDto.role,
          status: "pending",
          referralCode: createUserDto.referralCode,
          profile: {
            create: {
              fullName: createUserDto.fullName,
              phone: createUserDto.phone,
              licenseNumber: createUserDto.licenseNumber,
              address: createUserDto.address,
            },
          },
        },
      });
      expect(result).toEqual(mockUser);
    });

    it("should create a user without optional fields", async () => {
      const minimalDto = {
        email: "minimal@example.com",
        password: "hashedPassword",
        role: UserRole.patient,
        fullName: "Minimal User",
      };

      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        email: minimalDto.email,
        role: minimalDto.role,
      });

      const result = await service.create(minimalDto);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: minimalDto.email,
          role: minimalDto.role,
          status: "pending",
          referralCode: undefined,
          profile: {
            create: {
              fullName: minimalDto.fullName,
              phone: undefined,
              licenseNumber: undefined,
              address: undefined,
            },
          },
        },
      });
      expect(result).toBeDefined();
    });
  });

  describe("findByEmail", () => {
    it("should return user with profile when found", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail("test@example.com");

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        include: { profile: true },
      });
      expect(result).toEqual(mockUser);
    });

    it("should return null when user not found", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail("nonexistent@example.com");

      expect(result).toBeNull();
    });
  });

  describe("findById", () => {
    it("should return user with profile when found", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById("1");

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
        include: { profile: true },
      });
      expect(result).toEqual(mockUser);
    });

    it("should return null when user not found", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findById("nonexistent-id");

      expect(result).toBeNull();
    });
  });

  describe("updateStatus", () => {
    it("should update user status", async () => {
      const updatedUser = { ...mockUser, status: UserStatus.approved };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateStatus("1", UserStatus.approved);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { status: UserStatus.approved },
      });
      expect(result).toEqual(updatedUser);
    });
  });
});
