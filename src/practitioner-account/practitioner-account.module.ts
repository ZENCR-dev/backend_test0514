import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PractitionerAccountService } from "./services/practitioner-account.service";
import { PractitionerAccountController } from "./practitioner-account.controller";
import { PaymentModule } from "../payment/payment.module";

@Module({
  imports: [PrismaModule, forwardRef(() => PaymentModule)],
  providers: [PractitionerAccountService],
  controllers: [PractitionerAccountController],
  exports: [PractitionerAccountService],
})
export class PractitionerAccountModule {}
