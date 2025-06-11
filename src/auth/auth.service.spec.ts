import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { UserService } from "../user/user.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";

// Mock bcrypt module
jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import * as bcrypt from "bcrypt";

describe("AuthService", () => {
  let service: AuthService;
  let userService: UserService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockUser = {
    id: "1",
    email: "test@example.com",
    password: "hashedPassword",
    role: UserRole.practitioner,
    status: UserStatus.approved,
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

  const mockUserService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("register", () => {
    const registerDto = {
      email: "newuser@example.com",
      password: "password123",
      role: UserRole.practitioner,
      fullName: "New User",
      phone: "987654321",
      licenseNumber: "LIC456",
      address: '{"street": "456 New St", "city": "New City"}',
    };

    it("should successfully register a new user", async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      mockConfigService.get.mockReturnValue("12");
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashedPassword");
      mockUserService.create.mockResolvedValue({
        ...mockUser,
        password: "hashedPassword",
      });

      const result = await service.register(registerDto);

      expect(mockUserService.findByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(mockUserService.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.password).toBeUndefined();
    });

    it("should throw ConflictException if user already exists", async () => {
      mockUserService.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockUserService.findByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(mockUserService.create).not.toHaveBeenCalled();
    });
  });

  describe("validateUser", () => {
    it("should return user without password if credentials are valid", async () => {
      const plainPassword = "password123";
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockUserService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.validateUser(mockUser.email, plainPassword);

      expect(mockUserService.findByEmail).toHaveBeenCalledWith(mockUser.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        plainPassword,
        mockUser.password,
      );
      expect(result).toBeDefined();
      expect(result.password).toBeUndefined();
    });

    it("should return null if user does not exist", async () => {
      mockUserService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser(
        "nonexistent@example.com",
        "password",
      );

      expect(result).toBeNull();
    });

    it("should return null if password is incorrect", async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      mockUserService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.validateUser(
        mockUser.email,
        "wrongpassword",
      );

      expect(result).toBeNull();
    });

    it("should throw UnauthorizedException if user is not approved", async () => {
      const pendingUser = { ...mockUser, status: UserStatus.pending };
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockUserService.findByEmail.mockResolvedValue(pendingUser);

      await expect(
        service.validateUser(mockUser.email, "password123"),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("login", () => {
    const loginDto = {
      email: "test@example.com",
      password: "password123",
    };

    it("should return access token and user on successful login", async () => {
      const userWithoutPassword = { ...mockUser };
      delete userWithoutPassword.password;

      jest
        .spyOn(service, "validateUser")
        .mockResolvedValue(userWithoutPassword);
      mockJwtService.sign.mockReturnValue("mock-jwt-token");

      const result = await service.login(loginDto);

      expect(service.validateUser).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        email: mockUser.email,
        sub: mockUser.id,
        role: mockUser.role,
      });
      expect(result).toEqual({
        access_token: "mock-jwt-token",
        user: userWithoutPassword,
      });
    });

    it("should throw UnauthorizedException on invalid credentials", async () => {
      jest.spyOn(service, "validateUser").mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("getProfile", () => {
    it("should return user profile", async () => {
      mockUserService.findById.mockResolvedValue(mockUser);

      const result = await service.getProfile(mockUser.id);

      expect(mockUserService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockUser);
    });

    it("should return null if user not found", async () => {
      mockUserService.findById.mockResolvedValue(null);

      const result = await service.getProfile("nonexistent-id");

      expect(result).toBeNull();
    });
  });
});
