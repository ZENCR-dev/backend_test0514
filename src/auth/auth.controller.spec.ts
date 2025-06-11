import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { UserRole, UserStatus } from "@prisma/client";
import { ConflictException, UnauthorizedException } from "@nestjs/common";

describe("AuthController (e2e)", () => {
  let app: INestApplication;
  let authService: AuthService;

  const mockUser = {
    id: "1",
    email: "test@example.com",
    role: UserRole.practitioner,
    status: UserStatus.approved,
    referralCode: null,
    createdAt: "2025-06-11T00:16:16.485Z",
    updatedAt: "2025-06-11T00:16:16.485Z",
    profile: {
      id: "1",
      userId: "1",
      fullName: "Test User",
      phone: "123456789",
      licenseNumber: "LIC123",
      address: '{"street": "123 Test St", "city": "Test City"}',
      createdAt: "2025-06-11T00:16:16.485Z",
      updatedAt: "2025-06-11T00:16:16.485Z",
    },
  };

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    getProfile: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    authService = moduleFixture.get<AuthService>(AuthService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe("/auth/register (POST)", () => {
    const registerDto = {
      email: "newuser@example.com",
      password: "password123",
      role: UserRole.practitioner,
      fullName: "New User",
      phone: "987654321",
      licenseNumber: "LIC456",
      address: '{"street": "456 New St", "city": "New City"}',
    };

    it("should register a new user successfully", async () => {
      mockAuthService.register.mockResolvedValue(mockUser);

      const response = await request(app.getHttpServer())
        .post("/auth/register")
        .send(registerDto)
        .expect(201);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
      expect(response.body).toEqual(mockUser);
    });

    it("should return 409 if user already exists", async () => {
      mockAuthService.register.mockRejectedValue(
        new ConflictException("User with this email already exists"),
      );

      await request(app.getHttpServer())
        .post("/auth/register")
        .send(registerDto)
        .expect(409);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });

    it("should return 400 for invalid input", async () => {
      const invalidDto = {
        email: "invalid-email",
        password: "123", // Too short
        role: "invalid-role",
        fullName: "",
      };

      await request(app.getHttpServer())
        .post("/auth/register")
        .send(invalidDto)
        .expect(400);

      expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it("should return 400 for missing required fields", async () => {
      const incompleteDto = {
        email: "test@example.com",
        // Missing password, role, fullName
      };

      await request(app.getHttpServer())
        .post("/auth/register")
        .send(incompleteDto)
        .expect(400);

      expect(mockAuthService.register).not.toHaveBeenCalled();
    });
  });

  describe("/auth/login (POST)", () => {
    const loginDto = {
      email: "test@example.com",
      password: "password123",
    };

    it("should login successfully with valid credentials", async () => {
      const loginResponse = {
        access_token: "mock-jwt-token",
        user: mockUser,
      };
      mockAuthService.login.mockResolvedValue(loginResponse);

      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send(loginDto)
        .expect(200);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
      expect(response.body).toEqual(loginResponse);
    });

    it("should return 401 for invalid credentials", async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException(
          "Invalid credentials or account not approved.",
        ),
      );

      await request(app.getHttpServer())
        .post("/auth/login")
        .send(loginDto)
        .expect(401);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
    });

    it("should return 400 for invalid input format", async () => {
      const invalidDto = {
        email: "invalid-email",
        password: "123", // Too short
      };

      await request(app.getHttpServer())
        .post("/auth/login")
        .send(invalidDto)
        .expect(400);

      expect(mockAuthService.login).not.toHaveBeenCalled();
    });
  });
});
