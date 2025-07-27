import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { CreatePrescriptionDto } from "./dto/create-prescription.dto";
import { PrescriptionsNewRepository } from "./prescriptions-new.repository";
import { QRCodeService } from "./services/qr-code.service";

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prescriptionsRepository: PrescriptionsNewRepository,
    private readonly qrCodeService: QRCodeService,
  ) {}

  async create(createPrescriptionDto: CreatePrescriptionDto, doctorId: string) {
    try {
      // 验证输入参数
      if (!doctorId) {
        throw new Error("医师ID不能为空");
      }

      if (!createPrescriptionDto.copies || createPrescriptionDto.copies <= 0) {
        throw new Error("帖数必须大于0");
      }

      // 验证药品存在性和可用性
      await this.validateMedicines(createPrescriptionDto.medicines);

      // 创建处方数据 - 隐私合规版本，无患者信息
      const prescriptionData = {
        doctorId,
        medicines: createPrescriptionDto.medicines,
        copies: createPrescriptionDto.copies, // Direct mapping: copies → copies
        notes: createPrescriptionDto.notes,
      };

      // 创建处方
      const prescription =
        await this.prescriptionsRepository.create(prescriptionData);

      return {
        success: true,
        data: prescription,
        message: "处方创建成功",
      };
    } catch (error) {
      throw new Error(`创建处方失败: ${error.message}`);
    }
  }

  async findAll(doctorId: string, options: { page?: number; limit?: number }) {
    try {
      const { page = 1, limit = 20 } = options;
      const prescriptions = await this.prescriptionsRepository.findByDoctor(
        doctorId,
        page,
        limit,
      );

      return {
        success: true,
        data: prescriptions.data,
        pagination: {
          page,
          limit,
          total: prescriptions.total,
          totalPages: Math.ceil(prescriptions.total / limit),
        },
      };
    } catch (error) {
      throw new Error(`获取处方列表失败: ${error.message}`);
    }
  }

  async findOne(id: string, doctorId: string) {
    try {
      // 验证输入参数
      if (!id || id.trim() === "" || !doctorId || doctorId.trim() === "") {
        throw new Error("处方ID和医师ID不能为空");
      }

      const prescription = await this.prescriptionsRepository.findById(id);

      if (!prescription) {
        throw new NotFoundException("处方不存在");
      }

      // 验证权限：只有处方的医生可以查看
      if (prescription.doctorId !== doctorId) {
        throw new ForbiddenException("无权访问此处方");
      }

      return {
        success: true,
        data: prescription,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error(`获取处方详情失败: ${error.message}`);
    }
  }

  async update(
    id: string,
    updatePrescriptionDto: Partial<CreatePrescriptionDto>,
    doctorId: string,
  ) {
    try {
      // 验证处方存在和权限
      // const existingPrescription = await this.findOne(id, doctorId);
      await this.findOne(id, doctorId);

      // 如果更新药品信息，需要重新验证
      if (updatePrescriptionDto.medicines) {
        await this.validateMedicines(updatePrescriptionDto.medicines);
      }

      // 构建更新数据
      const updateData: any = {};

      if (updatePrescriptionDto.medicines) {
        updateData.medicines = updatePrescriptionDto.medicines;
      }

      if (
        updatePrescriptionDto.copies !== undefined &&
        updatePrescriptionDto.copies !== null
      ) {
        updateData.copies = updatePrescriptionDto.copies; // Direct mapping: copies → copies
      }

      if (
        updatePrescriptionDto.notes !== undefined &&
        updatePrescriptionDto.notes !== null
      ) {
        updateData.notes = updatePrescriptionDto.notes;
      }

      const updatedPrescription = await this.prescriptionsRepository.update(
        id,
        updateData,
      );

      return {
        success: true,
        data: updatedPrescription,
        message: "处方更新成功",
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error(`更新处方失败: ${error.message}`);
    }
  }

  async remove(id: string, doctorId: string) {
    try {
      // 验证处方存在和权限
      await this.findOne(id, doctorId);

      await this.prescriptionsRepository.delete(id);

      return {
        success: true,
        message: "处方删除成功",
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error(`删除处方失败: ${error.message}`);
    }
  }

  async issuePrescription(id: string, doctorId: string) {
    try {
      // 验证处方存在和权限
      const result = await this.findOne(id, doctorId);
      const prescription = result.data;

      // 检查处方状态
      if (prescription.status !== "DRAFT") {
        throw new Error("只有草稿状态的处方才能开具");
      }

      // 生成QR码数据
      const prescriptionWithQR =
        this.qrCodeService.updatePrescriptionQRCode(prescription);

      // 更新处方状态为PAID（对应已开具）
      const updatedPrescription =
        await this.prescriptionsRepository.updateStatus(id, "PAID");

      // 更新QR码数据到数据库
      if (prescriptionWithQR.qrCodeData) {
        await this.prescriptionsRepository.update(id, {
          notes: `${prescription.notes || ""}\n[QR码已生成]`.trim(),
        });
      }

      return {
        success: true,
        data: {
          ...updatedPrescription,
          qrCodeString: prescriptionWithQR.qrCodeString,
        },
        message: "处方开具成功",
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error(`开具处方失败: ${error.message}`);
    }
  }

  async verifyPrescription(qrCodeString: string) {
    try {
      // 解析QR码数据
      const qrData = this.qrCodeService.parseQRCodeString(qrCodeString);

      if (!qrData) {
        throw new Error("无效的QR码格式");
      }

      // 验证QR码数据
      const verification = this.qrCodeService.verifyQRCodeData(qrData);

      if (!verification.isValid) {
        throw new Error(verification.error || "处方验证失败");
      }

      // 查询处方详情
      const prescription = await this.prescriptionsRepository.findById(
        qrData.prescriptionId,
      );

      if (!prescription) {
        throw new Error("处方不存在");
      }

      return {
        success: true,
        data: {
          prescription,
          verificationInfo: {
            issuedAt: qrData.issuedAt,
            expiresAt: qrData.expiresAt,
            verifyCode: qrData.verifyCode,
          },
        },
        message: "处方验证成功",
      };
    } catch (error) {
      throw new Error(`处方验证失败: ${error.message}`);
    }
  }

  async updateStatus(id: string, status: string, doctorId: string) {
    try {
      // 验证处方存在和权限
      await this.findOne(id, doctorId);

      const updatedPrescription =
        await this.prescriptionsRepository.updateStatus(id, status);

      return {
        success: true,
        data: updatedPrescription,
        message: "处方状态更新成功",
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error(`更新处方状态失败: ${error.message}`);
    }
  }

  private async validateMedicines(medicines: any[]) {
    // 实现药品验证逻辑
    if (!medicines || medicines.length === 0) {
      throw new Error("处方必须包含至少一种药品");
    }

    for (const medicine of medicines) {
      if (!medicine.medicineId || medicine.weight == null || !medicine.notes) {
        throw new Error("药品信息不完整：缺少药品ID、克重或用药说明");
      }

      if (medicine.weight <= 0) {
        throw new Error("药品克重必须大于0");
      }
    }

    return true;
  }
}
