import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { UserService } from "../user/user.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UserRole, UserStatus } from "@prisma/client";

describe("AuthService", () => {
  let service: AuthService;
  let userService: UserService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            createUser: jest.fn(),
            findByEmail: jest.fn(),
            findById: jest.fn(),
            updateRefreshToken: jest.fn(),
            findByRefreshToken: jest.fn(),
            clearRefreshToken: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
        {
          provide: "AUTH_CONFIG",
          useValue: {
            jwtSecret: "test_secret",
            jwtExpiresIn: "1d",
            bcryptSaltRounds: 10,
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
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
      };
      const user = { id: "1", ...registerDto };
      (userService.createUser as jest.Mock).mockResolvedValue(user);

      const result = await service.register(registerDto);
      expect(result.success).toBe(true);
      expect(result.user.id).toEqual("1");
    });
  });

  describe("login", () => {
    it("should return an access token for valid credentials", async () => {
      const user = {
        id: "1",
        email: "test@example.com",
        password: "hashedpassword",
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
      (userService.findById as jest.Mock).mockResolvedValue(user);
      (userService.updateRefreshToken as jest.Mock).mockResolvedValue(
        undefined,
      );
      (jwtService.sign as jest.Mock).mockReturnValue("test_token");

      const result = await service.login({
        email: "test@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
      expect(result.accessToken).toEqual("test_token");
      expect(result.refreshToken).toBeDefined();
      expect(userService.updateRefreshToken).toHaveBeenCalled();
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
