import { Module } from "@nestjs/common";
import { MedicinesController } from "./medicines.controller";
import { PublicMedicinesController } from "./public-medicines.controller";
import { MedicinesService } from "./medicines.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [MedicinesController, PublicMedicinesController],
  providers: [MedicinesService],
  exports: [MedicinesService],
})
export class MedicinesModule {}
