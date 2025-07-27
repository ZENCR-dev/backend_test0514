// 📋 处方模块 - DAY 3联调准备
// 新西兰中医药电子处方平台

import { Module } from "@nestjs/common";
import { PrescriptionsController } from "./prescriptions.controller";
import { PrescriptionsService } from "./prescriptions.service";
import { PrescriptionsRepository } from "./prescriptions.repository";
import { PrescriptionsNewRepository } from "./prescriptions-new.repository";
import { PrescriptionPaymentService } from "./services/prescription-payment.service";
import { MedicinesModule } from "../../medicines/medicines.module";
import { AuthModule } from "../../auth/auth.module";
import { PaymentModule } from "../../payment/payment.module";
import { PractitionerAccountModule } from "../../practitioner-account/practitioner-account.module";
import { QRCodeService } from "./services/qr-code.service";
import { PrismaModule } from "../../prisma/prisma.module";

@Module({
  imports: [
    MedicinesModule, // 导入药品模块，用于处方药品验证
    AuthModule, // 导入认证模块，用于医生权限验证
    PaymentModule, // 导入支付模块，用于处方支付
    PractitionerAccountModule, // 导入医师账户模块，用于余额操作
    PrismaModule,
  ],
  controllers: [PrescriptionsController],
  providers: [
    PrescriptionsService,
    PrescriptionsRepository,
    PrescriptionsNewRepository, // New Prescription-based repository
    PrescriptionPaymentService,
    QRCodeService,
  ],
  exports: [
    PrescriptionsService, // 导出服务供其他模块使用
    PrescriptionPaymentService, // 导出支付服务供其他模块使用
  ],
})
export class PrescriptionsModule {}
