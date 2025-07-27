import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PrescriptionsService } from "../../modules/prescriptions/prescriptions.service";

@Injectable()
export class PrescriptionScanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prescriptionsService: PrescriptionsService,
  ) {}

  /**
   * 扫码获取处方信息
   */
  async scanPrescription(qrCodeString: string, pharmacyId: string) {
    try {
      // 1. 验证QR码并获取处方信息
      const verificationResult =
        await this.prescriptionsService.verifyPrescription(qrCodeString);

      if (!verificationResult.success) {
        throw new BadRequestException("无效的QR码或处方不存在");
      }

      const prescription = verificationResult.data.prescription;

      // 2. 验证处方状态 - 必须是已支付状态
      if (prescription.status !== "PAID") {
        throw new BadRequestException("处方未支付，无法履约");
      }

      // 3. 检查是否已被其他药房处理
      const existingFulfillment = await this.prisma.fulfillmentProof.findFirst({
        where: {
          orderId: prescription.id,
          NOT: {
            pharmacyId: pharmacyId,
          },
        },
      });

      if (existingFulfillment) {
        throw new ForbiddenException("该处方已被其他药房处理");
      }

      // 4. 检查是否已履约
      const currentFulfillment = await this.prisma.fulfillmentProof.findFirst({
        where: {
          orderId: prescription.id,
          pharmacyId: pharmacyId,
        },
      });

      if (currentFulfillment) {
        throw new BadRequestException("该处方已履约，请勿重复操作");
      }

      // 5. 记录扫码日志
      await this.logScanActivity(pharmacyId, prescription.id, qrCodeString);

      // 6. 获取完整的处方和药品信息
      const detailedPrescription = await this.getDetailedPrescriptionInfo(
        prescription.id,
      );

      return {
        success: true,
        data: {
          prescription: detailedPrescription,
          canFulfill: true,
          message: "处方验证成功，可以履约",
        },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(`处方扫码失败: ${error.message}`);
    }
  }

  /**
   * 获取待履约处方列表
   */
  async getPendingPrescriptions(
    pharmacyId: string,
    options: {
      page?: number;
      limit?: number;
      timeRange?: "today" | "week" | "month";
    },
  ) {
    try {
      const { page = 1, limit = 20, timeRange } = options;
      const skip = (page - 1) * limit;

      // 构建时间过滤条件
      let dateFilter = {};
      if (timeRange) {
        const now = new Date();
        let startDate: Date;

        switch (timeRange) {
          case "today":
            startDate = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
            );
            break;
          case "week":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        }
        dateFilter = {
          createdAt: {
            gte: startDate,
          },
        };
      }

      // 查询已支付但未履约的处方
      const [prescriptions, total] = await Promise.all([
        this.prisma.order.findMany({
          where: {
            status: "PAID",
            fulfillmentProofs: {
              none: {},
            },
            ...dateFilter,
          },
          select: {
            id: true,
            platformOrderId: true,
            patientId: true,
            totalAmount: true,
            createdAt: true,
            items: {
              select: {
                id: true,
                medicineSnapshot: true,
                quantity: true,
                unitPrice: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
        this.prisma.order.count({
          where: {
            status: "PAID",
            fulfillmentProofs: {
              none: {},
            },
            ...dateFilter,
          },
        }),
      ]);

      // 格式化返回数据
      const formattedPrescriptions = prescriptions.map((prescription) => ({
        id: prescription.id,
        platformOrderId: prescription.platformOrderId,
        patientName: "未知患者",
        totalAmount: prescription.totalAmount,
        medicineCount: 0,
        paidAt: prescription.createdAt,
        status: (prescription as any).status || "PENDING",
      }));

      return {
        success: true,
        data: formattedPrescriptions,
        meta: {
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      throw new BadRequestException(`获取待履约处方列表失败: ${error.message}`);
    }
  }

  /**
   * 获取详细的处方信息
   */
  private async getDetailedPrescriptionInfo(prescriptionId: string) {
    const prescription = await this.prisma.order.findUnique({
      where: { id: prescriptionId },
      include: {
        items: {
          include: {
            medicine: true,
          },
        },
        practitioner: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                fullName: true,
                licenseNumber: true,
              },
            },
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException("处方不存在");
    }

    // 格式化药品信息
    const medicines = prescription.items.map((item) => ({
      medicineId: item.medicineId,
      name: item.medicine.name,
      chineseName: item.medicine.chineseName,
      quantity: item.quantity,
      unit: item.medicine.unit,
      dosageInstructions: item.dosageInstructions,
      basePrice: item.medicine.basePrice,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      medicineSnapshot: item.medicineSnapshot,
    }));

    return {
      id: prescription.id,
      platformOrderId: prescription.platformOrderId,
      practitionerId: prescription.practitionerId,
      practitionerInfo: {
        name: prescription.practitioner.profile?.fullName,
        licenseNumber: prescription.practitioner.profile?.licenseNumber,
      },
      patientId: prescription.patientId,
      medicines,
      status: prescription.status,
      totalAmount: prescription.totalAmount,
      createdAt: prescription.createdAt,
      notes: prescription.notes,
    };
  }

  /**
   * 记录扫码活动日志
   */
  private async logScanActivity(
    pharmacyId: string,
    prescriptionId: string,
    qrCodeString: string,
  ) {
    try {
      await this.prisma.eventLog.create({
        data: {
          eventType: "PRESCRIPTION_SCAN",
          payload: {
            pharmacyId,
            prescriptionId,
            qrCodeLength: qrCodeString.length,
            timestamp: new Date().toISOString(),
          },
          metadata: {
            source: "pharmacy_scan_service",
            userAgent: "pharmacy_app",
          },
        },
      });
    } catch (error) {
      // 日志记录失败不应影响主流程
      console.error("记录扫码日志失败:", error);
    }
  }
}
