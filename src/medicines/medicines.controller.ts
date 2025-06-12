import { Controller, Get, Query } from "@nestjs/common";
import { MedicinesService } from "./medicines.service";
import { FindMedicinesDto } from "./dto/find-medicines.dto";
import { FindMedicinesResponseDto } from "./dto/medicine.dto";

@Controller("medicines")
export class MedicinesController {
  constructor(private readonly medicinesService: MedicinesService) {}

  @Get()
  async findAll(
    @Query() query: FindMedicinesDto,
  ): Promise<FindMedicinesResponseDto> {
    return this.medicinesService.findAll(query);
  }
}
