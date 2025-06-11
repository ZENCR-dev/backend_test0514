import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { UserRole } from "@prisma/client";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PermissionService } from "../auth/services/permission.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Reflector } from "@nestjs/core";

describe("UserController (e2e)", () => {
  let app: INestApplication;
  let permissionService: PermissionService;

  const mockUserService = {
    findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    findOne: jest.fn().mockResolvedValue({ id: "1" }),
    update: jest.fn().mockResolvedValue({ id: "1" }),
    remove: jest.fn().mockResolvedValue({ id: "1" }),
  };

  const mockPermissionService = {
    checkPermission: jest.fn(),
  };

  const mockAdmin = { id: "admin-id", role: UserRole.admin };
  const mockPatient = { id: "patient-id", role: UserRole.patient };

  // Simplified mock for RolesGuard that directly checks permissions
  const mockRolesGuard = {
    canActivate: jest.fn().mockImplementation((context) => {
      const request = context.switchToHttp().getRequest();
      const user = request.user;
      const url = request.url;
      const method = request.method;

      console.log(
        `RolesGuard: ${method} ${url}, user: ${JSON.stringify(user)}`,
      );

      if (!user) {
        console.log("RolesGuard: No user found, denying access");
        return false;
      }

      // Admin can access everything
      if (user.role === UserRole.admin) {
        console.log("RolesGuard: Admin access granted");
        return true;
      }

      // GET /users - only admin allowed
      if (method === "GET" && url === "/users") {
        console.log("RolesGuard: Non-admin trying to access /users, denying");
        return false;
      }

      // GET /users/:id - allow if user is accessing their own profile
      if (method === "GET" && url.startsWith("/users/")) {
        const urlUserId = url.split("/")[2];
        const allowed = urlUserId === user.id;
        console.log(
          `RolesGuard: User ${user.id} accessing profile ${urlUserId}, allowed: ${allowed}`,
        );
        return allowed;
      }

      // Default deny
      console.log("RolesGuard: Default deny");
      return false;
    }),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: PermissionService, useValue: mockPermissionService },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          const userHeader = req.headers["x-user"];

          if (userHeader) {
            try {
              req.user = JSON.parse(userHeader);
              console.log("JwtAuthGuard: Set user =", req.user);
            } catch (error) {
              console.error(
                "JwtAuthGuard: Failed to parse user header:",
                error,
              );
              req.user = null;
            }
          } else {
            req.user = null;
          }
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    permissionService = moduleFixture.get<PermissionService>(PermissionService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (app) {
      await app.close();
    }
  });

  describe("GET /users", () => {
    it("should allow admin to get all users", async () => {
      console.log("Testing admin access to GET /users");
      console.log("Mock admin:", mockAdmin);

      await request(app.getHttpServer())
        .get("/users")
        .set("x-user", JSON.stringify(mockAdmin))
        .expect(200);
    });

    it("should forbid non-admin from getting all users", async () => {
      console.log("Testing patient access to GET /users (should be forbidden)");
      console.log("Mock patient:", mockPatient);

      await request(app.getHttpServer())
        .get("/users")
        .set("x-user", JSON.stringify(mockPatient))
        .expect(403);
    });
  });

  describe("GET /users/:id", () => {
    it("should allow user to get their own profile", async () => {
      console.log("Testing patient access to own profile");
      console.log("Mock patient:", mockPatient);
      console.log("URL:", `/users/${mockPatient.id}`);

      await request(app.getHttpServer())
        .get(`/users/${mockPatient.id}`)
        .set("x-user", JSON.stringify(mockPatient))
        .expect(200);
    });

    it("should forbid user from getting another user's profile", async () => {
      console.log(
        "Testing patient access to another profile (should be forbidden)",
      );

      await request(app.getHttpServer())
        .get("/users/another-id")
        .set("x-user", JSON.stringify(mockPatient))
        .expect(403);
    });
  });

  // Add similar tests for PATCH and DELETE
});
