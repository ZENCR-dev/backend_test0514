import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { FileUploadService } from "./file-upload.service";
import { PurchaseOrderService } from "./purchase-order.service";
import { WebSocketEventEmitterService } from "../../common/services/websocket-event-emitter.service";

export interface FulfillmentUploadDto {
  orderId: string;
  packagePhoto: Express.Multer.File;
  scalePhoto: Express.Multer.File;
  actualWeight: number;
  notes?: string;
}

@Injectable()
export class FulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileUploadService: FileUploadService,
    private readonly purchaseOrderService: PurchaseOrderService,
    private readonly websocketEventEmitter: WebSocketEventEmitterService,
  ) {}

  /**
   * 上传履约凭证
   */
  async uploadFulfillmentProof(
    pharmacyId: string,
    fulfillmentData: FulfillmentUploadDto,
  ) {
    const { orderId, packagePhoto, scalePhoto, actualWeight, notes } =
      fulfillmentData;

    // 使用事务确保数据一致性
    return await this.prisma.$transaction(async (tx) => {
      try {
        // 1. 验证订单存在且状态正确
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            items: {
              include: {
                medicine: true,
              },
            },
          },
        });

        if (!order) {
          throw new NotFoundException("订单不存在");
        }

        if (order.status !== "PAID") {
          throw new BadRequestException("订单状态不正确，只能履约已支付的订单");
        }

        // 2. 检查是否已履约
        const existingProof = await tx.fulfillmentProof.findFirst({
          where: { orderId },
        });

        if (existingProof) {
          throw new BadRequestException("该订单已履约，请勿重复操作");
        }

        // 3. 上传文件
        const [packagePhotoUrl, scalePhotoUrl] = await Promise.all([
          this.fileUploadService.uploadFile(
            packagePhoto,
            "fulfillment/package",
          ),
          this.fileUploadService.uploadFile(scalePhoto, "fulfillment/scale"),
        ]);

        // 4. 创建履约凭证记录
        const fulfillmentProof = await tx.fulfillmentProof.create({
          data: {
            orderId,
            pharmacyId,
            proofFiles: {
              packagePhoto: packagePhotoUrl,
              scalePhoto: scalePhotoUrl,
              actualWeight,
            },
            notes,
            reviewStatus: "pending",
            metadata: {
              uploadedAt: new Date().toISOString(),
              fileInfo: {
                packagePhoto: {
                  originalName: packagePhoto.originalname,
                  size: packagePhoto.size,
                },
                scalePhoto: {
                  originalName: scalePhoto.originalname,
                  size: scalePhoto.size,
                },
              },
            },
          },
        });

        // 5. 更新订单状态为已履约
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "FULFILLED",
            dispensedAt: new Date(),
          },
        });

        // 6. 自动生成采购订单
        const purchaseOrder =
          await this.purchaseOrderService.generatePurchaseOrder(
            pharmacyId,
            orderId,
            fulfillmentProof.id,
            order.items,
            tx,
          );

        // 7. 发送实时通知
        await this.sendFulfillmentNotifications(
          pharmacyId,
          fulfillmentProof,
          purchaseOrder,
        );

        return {
          success: true,
          data: {
            fulfillmentProof: {
              id: fulfillmentProof.id,
              orderId,
              pharmacyId,
              proofFiles: fulfillmentProof.proofFiles,
              actualWeight,
              reviewStatus: fulfillmentProof.reviewStatus,
              createdAt: fulfillmentProof.createdAt,
            },
            orderStatus: "FULFILLED",
            purchaseOrder: {
              id: purchaseOrder.id,
              poNumber: purchaseOrder.poNumber,
              status: purchaseOrder.status,
            },
          },
        };
      } catch (error) {
        // 如果出错，清理已上传的文件
        if (packagePhoto && scalePhoto) {
          await this.cleanupUploadedFiles([packagePhoto, scalePhoto]);
        }
        throw error;
      }
    });
  }

  /**
   * 获取履约记录列表
   */
  async getFulfillmentRecords(
    pharmacyId: string,
    options: {
      status?: "pending" | "approved" | "rejected";
      page?: number;
      limit?: number;
    },
  ) {
    try {
      const { status, page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;

      const whereClause: any = { pharmacyId };
      if (status) {
        whereClause.reviewStatus = status;
      }

      const [records, total] = await Promise.all([
        this.prisma.fulfillmentProof.findMany({
          where: whereClause,
          include: {
            order: {
              select: {
                id: true,
                platformOrderId: true,
                totalAmount: true,
              },
            },
            reviewer: {
              select: {
                id: true,
                profile: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
        this.prisma.fulfillmentProof.count({
          where: whereClause,
        }),
      ]);

      const formattedRecords = records.map((record) => ({
        id: record.id,
        orderId: record.orderId,
        platformOrderId: record.order.platformOrderId,
        patientName: "未知患者",
        reviewStatus: record.reviewStatus,
        amount: record.order.totalAmount,
        actualWeight: (record.proofFiles as any)?.actualWeight,
        createdAt: record.createdAt,
        reviewedAt: record.reviewedAt,
        reviewerName: record.reviewer?.profile?.fullName,
        reviewNotes: record.reviewNotes,
      }));

      return {
        success: true,
        data: formattedRecords,
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
      throw new BadRequestException(`获取履约记录失败: ${error.message}`);
    }
  }

  /**
   * 获取履约记录详情
   */
  async getFulfillmentDetail(fulfillmentId: string, pharmacyId: string) {
    try {
      const record = await this.prisma.fulfillmentProof.findFirst({
        where: {
          id: fulfillmentId,
          pharmacyId,
        },
        include: {
          order: {
            include: {
              items: {
                include: {
                  medicine: true,
                },
              },
            },
          },
          reviewer: {
            select: {
              profile: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
      });

      if (!record) {
        throw new NotFoundException("履约记录不存在");
      }

      return {
        success: true,
        data: {
          id: record.id,
          orderId: record.orderId,
          order: {
            platformOrderId: record.order.platformOrderId,
            totalAmount: record.order.totalAmount,
            items: record.order.items.map((item) => ({
              medicineName: item.medicine.name,
              quantity: item.quantity,
              unit: item.medicine.unit,
              dosageInstructions: item.dosageInstructions,
            })),
          },
          proofFiles: record.proofFiles,
          notes: record.notes,
          reviewStatus: record.reviewStatus,
          reviewNotes: record.reviewNotes,
          reviewedAt: record.reviewedAt,
          reviewerName: record.reviewer?.profile?.fullName,
          createdAt: record.createdAt,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`获取履约记录详情失败: ${error.message}`);
    }
  }

  /**
   * 发送履约相关通知
   */
  private async sendFulfillmentNotifications(
    pharmacyId: string,
    fulfillmentProof: any,
    purchaseOrder: any,
  ) {
    try {
      // 发送给药房的通知
      await this.websocketEventEmitter.emitStandardEvent(
        "fulfillment.created",
        pharmacyId,
        {
          fulfillmentProofId: fulfillmentProof.id,
          orderId: fulfillmentProof.orderId,
          purchaseOrderId: purchaseOrder.id,
          status: "pending_review",
        },
      );

      // 发送给管理员的通知
      await this.websocketEventEmitter.emitStandardEvent(
        "fulfillment.pending_review",
        "admin",
        {
          fulfillmentProofId: fulfillmentProof.id,
          pharmacyId,
          orderId: fulfillmentProof.orderId,
          purchaseOrderId: purchaseOrder.id,
        },
      );
    } catch (error) {
      console.error("发送履约通知失败:", error);
    }
  }

  /**
   * 清理上传失败的文件
   */
  private async cleanupUploadedFiles(files: Express.Multer.File[]) {
    try {
      for (const file of files) {
        await this.fileUploadService.deleteFile(file.filename);
      }
    } catch (error) {
      console.error("清理上传文件失败:", error);
    }
  }
}
