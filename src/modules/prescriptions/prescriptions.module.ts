// 📋 处方模块 - DAY 3联调准备
// 新西兰中医药电子处方平台

import { Module } from "@nestjs/common";
import { PrescriptionsController } from "./prescriptions.controller";
import { PrescriptionsService } from "./prescriptions.service";
import { PrescriptionsRepository } from "./prescriptions.repository";
import { MedicinesModule } from "../../medicines/medicines.module";
import { AuthModule } from "../../auth/auth.module";

@Module({
  imports: [
    MedicinesModule, // 导入药品模块，用于处方药品验证
    AuthModule, // 导入认证模块，用于医生权限验证
  ],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService, PrescriptionsRepository],
  exports: [
    PrescriptionsService, // 导出服务供其他模块使用
  ],
})
export class PrescriptionsModule {}
