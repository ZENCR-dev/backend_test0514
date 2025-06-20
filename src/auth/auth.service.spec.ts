import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { UserService } from "../user/user.service";
import { UserRole, UserStatus } from "@prisma/client";

describe("AuthService", () => {
  let service: AuthService;
  let mockUserService: jest.Mocked<UserService>;
  let mockJwtService: jest.Mocked<JwtService>;

  const mockAuthConfig = {
    jwtSecret: "test-secret",
    jwtExpiresIn: "1h",
    refreshTokenExpiresIn: "7d",
  };

  beforeEach(async () => {
    const mockUserServiceMethods = {
      createUser: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      updateRefreshToken: jest.fn(),
    };

    const mockJwtServiceMethods = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        PrismaService,
        { provide: UserService, useValue: mockUserServiceMethods },
        { provide: JwtService, useValue: mockJwtServiceMethods },
        { provide: "AUTH_CONFIG", useValue: mockAuthConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    mockUserService = module.get(UserService);
    mockJwtService = module.get(JwtService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("register", () => {
    it("should register a new user", async () => {
      const registerDto = {
        email: "test@example.com",
        password: "password123",
        role: UserRole.practitioner,
        fullName: "Test User",
        phone: "123456789",
        address: "Test Address",
      };
      const user = {
        id: "1",
        email: registerDto.email,
        role: registerDto.role,
      };
      mockUserService.createUser.mockResolvedValue(user as any);

      const result = await service.register(registerDto);
      expect(result.success).toBe(true);
      expect(result.user?.id).toEqual("1");
    });
  });

  describe("login", () => {
    it("should return an access token for valid credentials", async () => {
      const user = {
        id: "1",
        email: "test@example.com",
        role: UserRole.practitioner,
        status: UserStatus.approved,
        profile: {
          fullName: "Test User",
          phone: "123456789",
        },
      };

      jest
        .spyOn(service, "validateUserPassword")
        .mockResolvedValue({ isValid: true, user: user });
      mockUserService.findById.mockResolvedValue(user as any);
      mockJwtService.sign.mockReturnValue("test_token");

      const result = await service.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toEqual("test_token");
      expect(result.refreshToken).toBeDefined();
    });

    it("should fail for invalid credentials", async () => {
      jest
        .spyOn(service, "validateUserPassword")
        .mockResolvedValue({ isValid: false });

      const result = await service.login({
        email: "test@example.com",
        password: "wrongpassword",
      });

      expect(result.success).toBe(false);
    });
  });
});
