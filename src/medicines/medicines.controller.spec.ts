import { Test, TestingModule } from "@nestjs/testing";
import { MedicinesController } from "./medicines.controller";
import { MedicinesService } from "./medicines.service";

describe("MedicinesController", () => {
  let controller: MedicinesController;
  let medicinesService: MedicinesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedicinesController],
      providers: [
        {
          provide: MedicinesService,
          useValue: {
            findAll: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MedicinesController>(MedicinesController);
    medicinesService = module.get<MedicinesService>(MedicinesService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
