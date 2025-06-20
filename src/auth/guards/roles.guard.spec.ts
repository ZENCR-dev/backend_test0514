import { Test, TestingModule } from "@nestjs/testing";
import { RolesGuard } from "./roles.guard";
import { Reflector } from "@nestjs/core";
import { PermissionService } from "../services/permission.service";

describe("RolesGuard", () => {
  let guard: RolesGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {},
        },
        {
          provide: PermissionService,
          useValue: {},
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });
});
