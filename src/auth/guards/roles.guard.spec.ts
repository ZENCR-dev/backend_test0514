import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { ExecutionContext } from "@nestjs/common";
import { RolesGuard } from "./roles.guard";
import { UserRole } from "@prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  describe("canActivate", () => {
    let mockExecutionContext: Partial<ExecutionContext>;
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        user: {
          id: "1",
          email: "test@example.com",
          role: UserRole.practitioner,
        },
      };

      mockExecutionContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      };
    });

    it("should return true if no roles are required", () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      const result = guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        mockExecutionContext.getHandler(),
        mockExecutionContext.getClass(),
      ]);
      expect(result).toBe(true);
    });

    it("should return true if user has required role", () => {
      mockReflector.getAllAndOverride.mockReturnValue([
        UserRole.practitioner,
        UserRole.admin,
      ]);

      const result = guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(true);
    });

    it("should return false if user does not have required role", () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.admin]);
      mockRequest.user.role = UserRole.patient;

      const result = guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(false);
    });

    it("should return false if user is not present in request", () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.practitioner]);
      mockRequest.user = undefined;

      const result = guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(false);
    });

    it("should return false if user does not have role property", () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.practitioner]);
      mockRequest.user = { id: "1", email: "test@example.com" }; // No role property

      const result = guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(false);
    });

    it("should handle multiple required roles correctly", () => {
      mockReflector.getAllAndOverride.mockReturnValue([
        UserRole.admin,
        UserRole.pharmacy_operator,
        UserRole.practitioner,
      ]);
      mockRequest.user.role = UserRole.pharmacy_operator;

      const result = guard.canActivate(
        mockExecutionContext as ExecutionContext,
      );

      expect(result).toBe(true);
    });
  });
});
