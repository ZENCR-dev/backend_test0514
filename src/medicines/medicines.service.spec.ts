import { Test, TestingModule } from "@nestjs/testing";
import { MedicinesService } from "./medicines.service";
import { PrismaService } from "../prisma/prisma.service";

describe("MedicinesService", () => {
  let service: MedicinesService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicinesService,
        {
          provide: PrismaService,
          useValue: {
            medicine: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MedicinesService>(MedicinesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
