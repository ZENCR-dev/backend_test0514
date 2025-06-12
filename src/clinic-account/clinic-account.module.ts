import { Module } from "@nestjs/common";
import { ClinicAccountController } from "./clinic-account.controller";
import { ClinicAccountService } from "./services/clinic-account.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ClinicAccountController],
  providers: [ClinicAccountService],
  exports: [ClinicAccountService],
})
export class ClinicAccountModule {}
