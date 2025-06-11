import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import { PermissionService } from "../services/permission.service";
import { UserRole } from "@prisma/client";
import {
  PERMISSION_METADATA_KEY,
  REQUIRE_OWNERSHIP_KEY,
  REQUIRE_CLINIC_MEMBERSHIP_KEY,
  ALLOW_ADMIN_OVERRIDE_KEY,
} from "../decorators/permissions.decorator";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { Action, Resource } from "../interfaces/permission.interface";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let permissionService: PermissionService;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const mockPermissionService = {
    checkPermission: jest.fn(),
  };

  const createMockExecutionContext = (
    user: any = { id: "user-1", role: UserRole.patient },
  ): ExecutionContext =>
    ({
      switchToHttp: jest.fn(() => ({
        getRequest: jest.fn(() => ({
          user,
          params: {},
          body: {},
          query: {},
        })),
        getResponse: jest.fn(),
        getNext: jest.fn(),
      })),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    }) as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: PermissionService, useValue: mockPermissionService },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
    permissionService = module.get<PermissionService>(PermissionService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  describe("canActivate", () => {
    it("should return true when permissions are met", async () => {
      const permissions = [{ action: Action.READ, resource: Resource.USER }];
      mockReflector.getAllAndOverride
        .mockReturnValueOnce(false) // admin override
        .mockReturnValueOnce(permissions) // permissions
        .mockReturnValueOnce(null) // conditions
        .mockReturnValueOnce(null) // ownership
        .mockReturnValueOnce(null); // clinic

      mockPermissionService.checkPermission.mockResolvedValue({
        allowed: true,
      });
      const mockContext = createMockExecutionContext();

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockPermissionService.checkPermission).toHaveBeenCalled();
    });

    it("should return false when permissions are not met", async () => {
      const permissions = [{ action: Action.DELETE, resource: Resource.USER }];
      mockReflector.getAllAndOverride
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(permissions)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);

      mockPermissionService.checkPermission.mockResolvedValue({
        allowed: false,
      });
      const mockContext = createMockExecutionContext();

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it("should deny access with role check when roles do not match", async () => {
      mockReflector.getAllAndOverride
        .mockReturnValueOnce(false) // admin
        .mockReturnValueOnce(null) // perms
        .mockReturnValueOnce(null) // conditions
        .mockReturnValueOnce(null) // owner
        .mockReturnValueOnce(null) // clinic
        .mockReturnValueOnce([UserRole.practitioner]); // ROLES_KEY

      const mockContext = createMockExecutionContext({
        id: "patient-1",
        role: UserRole.patient,
      });
      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });
  });

  describe("extractResourceInfo", () => {
    it("should extract resource ID from params", async () => {
      const mockUser = { id: "user-1", role: UserRole.patient };
      const mockContext: ExecutionContext = {
        switchToHttp: jest.fn(() => ({
          getRequest: jest.fn(() => ({
            user: mockUser,
            params: { id: "resource-123" },
            body: {},
            query: {},
          })),
          getResponse: jest.fn(),
          getNext: jest.fn(),
        })),
        getHandler: jest.fn(),
        getClass: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
        getType: jest.fn(),
      } as ExecutionContext;

      mockReflector.getAllAndOverride
        .mockReturnValueOnce(false) // ALLOW_ADMIN_OVERRIDE_KEY
        .mockReturnValueOnce([{ action: Action.READ, resource: Resource.USER }]) // PERMISSION_METADATA_KEY
        .mockReturnValueOnce(null) // PERMISSION_CONDITIONS_KEY
        .mockReturnValueOnce(null) // REQUIRE_OWNERSHIP_KEY
        .mockReturnValueOnce(null); // REQUIRE_CLINIC_MEMBERSHIP_KEY

      mockPermissionService.checkPermission.mockResolvedValue({
        allowed: true,
        reason: "Permission granted",
      });

      await guard.canActivate(mockContext);

      expect(mockPermissionService.checkPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: "resource-123",
        }),
      );
    });

    it("should extract resource data from body", async () => {
      const bodyData = { name: "Test", clinicId: "clinic-1" };
      const mockUser = { id: "user-1", role: UserRole.patient };

      const mockContext: ExecutionContext = {
        switchToHttp: jest.fn(() => ({
          getRequest: jest.fn(() => ({
            user: mockUser,
            params: {},
            body: bodyData,
            query: {},
          })),
          getResponse: jest.fn(),
          getNext: jest.fn(),
        })),
        getHandler: jest.fn(),
        getClass: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
        getType: jest.fn(),
      } as ExecutionContext;

      mockReflector.getAllAndOverride
        .mockReturnValueOnce(false) // ALLOW_ADMIN_OVERRIDE_KEY
        .mockReturnValueOnce([
          { action: Action.CREATE, resource: Resource.USER },
        ]) // PERMISSION_METADATA_KEY
        .mockReturnValueOnce(null) // PERMISSION_CONDITIONS_KEY
        .mockReturnValueOnce(null) // REQUIRE_OWNERSHIP_KEY
        .mockReturnValueOnce(null); // REQUIRE_CLINIC_MEMBERSHIP_KEY

      mockPermissionService.checkPermission.mockResolvedValue({
        allowed: true,
        reason: "Permission granted",
      });

      await guard.canActivate(mockContext);

      expect(mockPermissionService.checkPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceData: bodyData,
        }),
      );
    });

    it("should extract resource ID from query params when not in params", async () => {
      const mockUser = { id: "user-1", role: UserRole.patient };

      const mockContext: ExecutionContext = {
        switchToHttp: jest.fn(() => ({
          getRequest: jest.fn(() => ({
            user: mockUser,
            params: {},
            body: {},
            query: { id: "query-resource-456" },
          })),
          getResponse: jest.fn(),
          getNext: jest.fn(),
        })),
        getHandler: jest.fn(),
        getClass: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
        getType: jest.fn(),
      } as ExecutionContext;

      mockReflector.getAllAndOverride
        .mockReturnValueOnce(false) // ALLOW_ADMIN_OVERRIDE_KEY
        .mockReturnValueOnce([{ action: Action.READ, resource: Resource.USER }]) // PERMISSION_METADATA_KEY
        .mockReturnValueOnce(null) // PERMISSION_CONDITIONS_KEY
        .mockReturnValueOnce(null) // REQUIRE_OWNERSHIP_KEY
        .mockReturnValueOnce(null); // REQUIRE_CLINIC_MEMBERSHIP_KEY

      mockPermissionService.checkPermission.mockResolvedValue({
        allowed: true,
        reason: "Permission granted",
      });

      await guard.canActivate(mockContext);

      expect(mockPermissionService.checkPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: "query-resource-456",
        }),
      );
    });
  });

  describe("error handling", () => {
    it("should throw ForbiddenException when an error occurs", async () => {
      mockReflector.getAllAndOverride.mockImplementation(() => {
        throw new Error("Reflector error");
      });

      const mockContext = createMockExecutionContext();
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        "Permission check failed",
      );
    });
  });
});
