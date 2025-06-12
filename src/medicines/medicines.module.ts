import { Module } from "@nestjs/common";
import { MedicinesController } from "./medicines.controller";
import { MedicinesService } from "./medicines.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [MedicinesController],
  providers: [MedicinesService],
})
export class MedicinesModule {}
