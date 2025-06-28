import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PractitionerAccountService } from "./services/practitioner-account.service";
import { PractitionerAccountController } from "./practitioner-account.controller";

@Module({
  imports: [PrismaModule],
  providers: [PractitionerAccountService],
  controllers: [PractitionerAccountController],
  exports: [PractitionerAccountService],
})
export class PractitionerAccountModule {}
