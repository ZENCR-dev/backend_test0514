import { Test, TestingModule } from "@nestjs/testing";
import { PermissionService } from "./permission.service";
import { UserRole } from "@prisma/client";
import {
  Action,
  Resource,
  PermissionConditionType,
  PermissionCheckRequest,
} from "../interfaces/permission.interface";

describe("PermissionService", () => {
  let service: PermissionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionService],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("checkPermission", () => {
    it("should allow admin to access all resources", async () => {
      const request: PermissionCheckRequest = {
        user: { id: "admin-1", role: UserRole.admin },
        action: Action.DELETE,
        resource: Resource.USER,
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(true);
    });

    it("should allow practitioner to read user information", async () => {
      const request: PermissionCheckRequest = {
        user: { id: "practitioner-1", role: UserRole.practitioner },
        action: Action.READ,
        resource: Resource.USER,
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(true);
    });

    it("should deny practitioner from deleting users", async () => {
      const request: PermissionCheckRequest = {
        user: { id: "practitioner-1", role: UserRole.practitioner },
        action: Action.DELETE,
        resource: Resource.USER,
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(false);
    });

    it("should allow user to update their own profile", async () => {
      const request: PermissionCheckRequest = {
        user: { id: "user-1", role: UserRole.patient },
        action: Action.UPDATE,
        resource: Resource.USER,
        resourceId: "user-1",
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(true);
    });

    it("should deny user from updating other users profile", async () => {
      const request: PermissionCheckRequest = {
        user: { id: "user-1", role: UserRole.patient },
        action: Action.UPDATE,
        resource: Resource.USER,
        resourceId: "user-2",
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(false);
    });

    it("should allow clinic member to read patient data", async () => {
      const request: PermissionCheckRequest = {
        user: {
          id: "practitioner-1",
          role: UserRole.practitioner,
          clinicId: "clinic-1",
        },
        action: Action.READ,
        resource: Resource.PATIENT,
        resourceData: { clinicId: "clinic-1" },
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(true);
    });

    it("should deny access to patient from different clinic", async () => {
      const request: PermissionCheckRequest = {
        user: {
          id: "practitioner-1",
          role: UserRole.practitioner,
          clinicId: "clinic-1",
        },
        action: Action.READ,
        resource: Resource.PATIENT,
        resourceData: { clinicId: "clinic-2" },
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(false);
    });

    it("should allow pharmacy_operator to read prescriptions", async () => {
      const request: PermissionCheckRequest = {
        user: { id: "pharmacy-1", role: UserRole.pharmacy_operator },
        action: Action.READ,
        resource: Resource.PRESCRIPTION,
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(true);
    });

    it("should allow pharmacy_operator to update prescription status", async () => {
      const request: PermissionCheckRequest = {
        user: { id: "pharmacy-1", role: UserRole.pharmacy_operator },
        action: Action.UPDATE,
        resource: Resource.PRESCRIPTION,
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(true);
    });

    it("should deny pharmacy_operator from creating prescriptions", async () => {
      const request: PermissionCheckRequest = {
        user: { id: "pharmacy-1", role: UserRole.pharmacy_operator },
        action: Action.CREATE,
        resource: Resource.PRESCRIPTION,
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(false);
    });

    it("should handle unknown permissions gracefully", async () => {
      const request: PermissionCheckRequest = {
        user: { id: "user-1", role: UserRole.patient },
        action: Action.MANAGE,
        resource: Resource.CLINIC,
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("No permission found");
    });
  });

  describe("hasPermission", () => {
    it("should return true for allowed permissions", async () => {
      const hasPermission = await service.hasPermission(
        { id: "admin-1", role: UserRole.admin },
        Action.DELETE,
        Resource.USER,
      );

      expect(hasPermission).toBe(true);
    });

    it("should return false for denied permissions", async () => {
      const hasPermission = await service.hasPermission(
        { id: "patient-1", role: UserRole.patient },
        Action.DELETE,
        Resource.USER,
      );

      expect(hasPermission).toBe(false);
    });
  });

  describe("getUserPermissions", () => {
    it("should return admin permissions", () => {
      const permissions = service.getUserPermissions(UserRole.admin);
      expect(permissions).toHaveLength(1);
      expect(permissions[0].action).toBe(Action.MANAGE);
      expect(permissions[0].resource).toBe(Resource.ALL);
    });

    it("should return practitioner permissions", () => {
      const permissions = service.getUserPermissions(UserRole.practitioner);
      expect(permissions.length).toBeGreaterThan(0);

      // 检查医生是否有处方管理权限
      const prescriptionPermission = permissions.find(
        (p) =>
          p.resource === Resource.PRESCRIPTION && p.action === Action.MANAGE,
      );
      expect(prescriptionPermission).toBeDefined();
    });

    it("should return patient permissions", () => {
      const permissions = service.getUserPermissions(UserRole.patient);
      expect(permissions.length).toBeGreaterThan(0);

      // 检查患者是否只能访问自己的资源
      permissions.forEach((permission) => {
        if (permission.conditions) {
          expect(
            permission.conditions.some(
              (c) => c.type === PermissionConditionType.OWNER,
            ),
          ).toBe(true);
        }
      });
    });

    it("should return empty array for unknown role", () => {
      const permissions = service.getUserPermissions("unknown" as UserRole);
      expect(permissions).toEqual([]);
    });
  });

  describe("ownership condition checking", () => {
    it("should allow access when user is resource owner via resourceId", async () => {
      const request: PermissionCheckRequest = {
        user: { id: "user-1", role: UserRole.patient },
        action: Action.READ,
        resource: Resource.USER_PROFILE,
        resourceId: "user-1",
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(true);
    });

    it("should allow access when user is resource owner via resourceData", async () => {
      const request: PermissionCheckRequest = {
        user: { id: "user-1", role: UserRole.patient },
        action: Action.READ,
        resource: Resource.USER_PROFILE,
        resourceData: { userId: "user-1" },
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(true);
    });

    it("should deny access when user is not resource owner", async () => {
      const request: PermissionCheckRequest = {
        user: { id: "user-1", role: UserRole.patient },
        action: Action.READ,
        resource: Resource.USER_PROFILE,
        resourceId: "user-2",
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(false);
    });
  });

  describe("clinic membership condition checking", () => {
    it("should allow access for same clinic members", async () => {
      const request: PermissionCheckRequest = {
        user: {
          id: "practitioner-1",
          role: UserRole.practitioner,
          clinicId: "clinic-1",
        },
        action: Action.READ,
        resource: Resource.PATIENT,
        resourceData: { clinicId: "clinic-1" },
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(true);
    });

    it("should deny access for different clinic members", async () => {
      const request: PermissionCheckRequest = {
        user: {
          id: "practitioner-1",
          role: UserRole.practitioner,
          clinicId: "clinic-1",
        },
        action: Action.UPDATE,
        resource: Resource.PATIENT,
        resourceData: { clinicId: "clinic-2" },
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(false);
    });

    it("should deny access when user has no clinic", async () => {
      const request: PermissionCheckRequest = {
        user: { id: "practitioner-1", role: UserRole.practitioner },
        action: Action.READ,
        resource: Resource.PATIENT,
        resourceData: { clinicId: "clinic-1" },
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      // 模拟一个会导致错误的场景
      const request: PermissionCheckRequest = {
        user: null as any,
        action: Action.READ,
        resource: Resource.USER,
      };

      const result = await service.checkPermission(request);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Permission check error");
    });
  });
});
