import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { UserService } from "./user.service";
import { UserProfileService } from "./services/user-profile.service";
import { UserValidationService } from "./services/user-validation.service";
import { UserStatus, UserRole } from "@prisma/client";

describe("UserService", () => {
  let service: UserService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            $transaction: jest
              .fn()
              .mockImplementation(async (callback) => callback(prismaService)),
          },
        },
        {
          provide: UserProfileService,
          useValue: {
            // Mock methods if they are called directly in UserService tests
          },
        },
        {
          provide: UserValidationService,
          useValue: {
            validateRegistrationData: jest.fn().mockResolvedValue(undefined),
            validateUpdateData: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createUser", () => {
    it("should create a new user with a profile", async () => {
      const createUserData = {
        email: "test@example.com",
        password: "password123",
        role: UserRole.practitioner,
        profile: {
          fullName: "Test User",
        },
      };

      const expectedUser = {
        id: "1",
        email: "test@example.com",
        role: UserRole.practitioner,
        status: UserStatus.pending,
        profile: {
          id: "p1",
          userId: "1",
          fullName: "Test User",
        },
      };

      (prismaService.user.create as jest.Mock).mockResolvedValue(expectedUser);

      const result = await service.createUser(createUserData);
      expect(result).toEqual(expectedUser);
      expect(prismaService.user.create).toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("should return a user by id", async () => {
      const user = { id: "1", email: "test@example.com" };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(user);
      const result = await service.findById("1");
      expect(result).toEqual(user);
    });
  });

  describe("findByEmail", () => {
    it("should return a user by email", async () => {
      const user = { id: "1", email: "test@example.com" };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(user);
      const result = await service.findByEmail("test@example.com");
      expect(result).toEqual(user);
    });
  });

  describe("updateUser", () => {
    it("should update a user", async () => {
      const user = { id: "1", email: "test@example.com" };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(user);
      (prismaService.user.update as jest.Mock).mockResolvedValue(user);

      const result = await service.updateUser("1", {
        email: "new@example.com",
      });
      expect(result).toEqual(user);
    });
  });

  describe("softDeleteUser", () => {
    it("should soft delete a user", async () => {
      const user = { id: "1", status: UserStatus.suspended };
      (prismaService.user.update as jest.Mock).mockResolvedValue(user);
      const result = await service.softDeleteUser("1");
      expect(result.status).toEqual(UserStatus.suspended);
    });
  });
});
