import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import { UserService } from "../user/user.service";
import { PermissionService } from "./services/permission.service";
import { Reflector } from "@nestjs/core";

describe("AuthController", () => {
  let controller: AuthController;

  const mockUserService = {
    createUser: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    updateRefreshToken: jest.fn(),
  };

  const mockPermissionService = {
    checkPermission: jest.fn(),
    hasRole: jest.fn(),
    hasPermission: jest.fn(),
  };

  const mockAuthConfig = {
    jwtSecret: "test-secret",
    jwtExpiresIn: "1h",
    refreshTokenExpiresIn: "7d",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtService,
        PrismaService,
        ConfigService,
        Reflector,
        { provide: UserService, useValue: mockUserService },
        { provide: PermissionService, useValue: mockPermissionService },
        { provide: "AUTH_CONFIG", useValue: mockAuthConfig },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
