import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

export interface GST_CONFIG {
  rate: number;
  inclusive: boolean;
}

export interface PrescriptionPOItem {
  medicineId: string;
  medicineName: string;
  quantity: number;
  weight: number;
  unitPrice: number;
  totalPrice: number;
  gstAmount: number;
  netAmount: number;
  dosageInstructions: string;
  additionalNotes?: string;
}

export interface CreatePrescriptionPOData {
  pharmacyId: string;
  prescriptionId: string;
  orderId?: string;
  fulfillmentProofId: string;
  prescriptionItems: PrescriptionPOItem[];
  metadata?: Record<string, any>;
}

@Injectable()
export class PrescriptionPurchaseOrderService {
  private readonly GST_RATE = 0.15; // New Zealand GST rate (15%)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate Purchase Order from Prescription
   */
  async generateFromPrescription(data: CreatePrescriptionPOData, tx?: any) {
    const prisma = tx || this.prisma;

    try {
      // 1. Validate prescription exists and is active
      const prescription = await prisma.prescription.findUnique({
        where: { id: data.prescriptionId },
        include: {
          medicines: {
            include: {
              medicine: true,
            },
          },
        },
      });

      if (!prescription) {
        throw new NotFoundException("处方不存在");
      }

      if (
        prescription.status === "CANCELLED" ||
        prescription.status === "EXPIRED"
      ) {
        throw new BadRequestException("处方已取消或过期，无法生成采购订单");
      }

      // 2. Generate PO number
      const poNumber = await this.generatePONumber();

      // 3. Calculate GST and net amounts for items
      const calculatedItems = this.calculateGSTForItems(data.prescriptionItems);

      // 4. Calculate totals
      const totalNetAmount = calculatedItems.reduce(
        (sum, item) => sum + item.netAmount,
        0,
      );
      const totalGSTAmount = calculatedItems.reduce(
        (sum, item) => sum + item.gstAmount,
        0,
      );
      const totalAmount = totalNetAmount + totalGSTAmount;

      // 5. Create purchase order
      const purchaseOrder = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          pharmacyId: data.pharmacyId,
          orderId: data.orderId,
          prescriptionId: data.prescriptionId,
          fulfillmentProofId: data.fulfillmentProofId,
          items: calculatedItems, // Legacy items field for backward compatibility
          medicineItems: calculatedItems, // New structured medicine items
          totalAmount: new Decimal(totalAmount),
          gstAmount: new Decimal(totalGSTAmount),
          netAmount: new Decimal(totalNetAmount),
          status: "pending_review",
          ...(data.metadata && { metadata: data.metadata }),
        },
        include: {
          prescription: {
            include: {
              practitioner: {
                include: {
                  profile: true,
                },
              },
            },
          },
          pharmacy: true,
        },
      });

      return {
        success: true,
        data: this.formatPurchaseOrderResponse(purchaseOrder),
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(`生成处方采购订单失败: ${error.message}`);
    }
  }

  /**
   * Get Purchase Orders by Prescription
   */
  async getByPrescriptionId(prescriptionId: string, pharmacyId?: string) {
    try {
      const whereClause: any = { prescriptionId };
      if (pharmacyId) {
        whereClause.pharmacyId = pharmacyId;
      }

      const purchaseOrders = await this.prisma.purchaseOrder.findMany({
        where: whereClause,
        include: {
          prescription: {
            include: {
              practitioner: {
                include: {
                  profile: true,
                },
              },
            },
          },
          pharmacy: true,
          order: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return {
        success: true,
        data: purchaseOrders.map((po) => this.formatPurchaseOrderResponse(po)),
      };
    } catch (error) {
      throw new BadRequestException(`获取处方采购订单失败: ${error.message}`);
    }
  }

  /**
   * Update Purchase Order Items with GST recalculation
   */
  async updatePrescriptionItems(
    poId: string,
    updatedItems: PrescriptionPOItem[],
    pharmacyId: string,
  ) {
    try {
      const existingPO = await this.prisma.purchaseOrder.findFirst({
        where: {
          id: poId,
          pharmacyId,
          status: { in: ["pending_review", "under_review"] },
        },
      });

      if (!existingPO) {
        throw new NotFoundException("采购订单不存在或无法修改");
      }

      // Recalculate GST for updated items
      const calculatedItems = this.calculateGSTForItems(updatedItems);

      // Recalculate totals
      const totalNetAmount = calculatedItems.reduce(
        (sum, item) => sum + item.netAmount,
        0,
      );
      const totalGSTAmount = calculatedItems.reduce(
        (sum, item) => sum + item.gstAmount,
        0,
      );
      const totalAmount = totalNetAmount + totalGSTAmount;

      const updatedPO = await this.prisma.purchaseOrder.update({
        where: { id: poId },
        data: {
          items: calculatedItems as any,
          medicineItems: calculatedItems as any,
          totalAmount: new Decimal(totalAmount),
          gstAmount: new Decimal(totalGSTAmount),
          netAmount: new Decimal(totalNetAmount),
          updatedAt: new Date(),
        },
        include: {
          prescription: {
            include: {
              practitioner: {
                include: {
                  profile: true,
                },
              },
            },
          },
          pharmacy: true,
        },
      });

      return {
        success: true,
        data: this.formatPurchaseOrderResponse(updatedPO),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`更新采购订单失败: ${error.message}`);
    }
  }

  /**
   * Calculate GST for items according to New Zealand tax law
   */
  private calculateGSTForItems(
    items: PrescriptionPOItem[],
  ): PrescriptionPOItem[] {
    return items.map((item) => {
      // For prescription medicines, GST is typically included in the price
      // Calculate net amount by removing GST from total price
      const totalPriceWithGST = item.totalPrice;
      const netAmount = totalPriceWithGST / (1 + this.GST_RATE);
      const gstAmount = totalPriceWithGST - netAmount;

      return {
        ...item,
        totalPrice: Number(totalPriceWithGST.toFixed(2)),
        netAmount: Number(netAmount.toFixed(2)),
        gstAmount: Number(gstAmount.toFixed(2)),
      };
    });
  }

  /**
   * Generate PO number with prescription prefix
   */
  private async generatePONumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

    // Find count of POs generated today with prescription prefix
    const count = await this.prisma.purchaseOrder.count({
      where: {
        poNumber: {
          startsWith: `PRX-PO-${dateStr}`,
        },
      },
    });

    const sequence = (count + 1).toString().padStart(3, "0");
    return `PRX-PO-${dateStr}-${sequence}`;
  }

  /**
   * Format purchase order for API response
   */
  private formatPurchaseOrderResponse(po: any) {
    return {
      id: po.id,
      poNumber: po.poNumber,
      pharmacyId: po.pharmacyId,
      prescriptionId: po.prescriptionId,
      orderId: po.orderId,
      fulfillmentProofId: po.fulfillmentProofId,
      items: po.medicineItems || po.items, // Prefer new structured data
      totalAmount: Number(po.totalAmount),
      gstAmount: po.gstAmount ? Number(po.gstAmount) : null,
      netAmount: po.netAmount ? Number(po.netAmount) : null,
      status: po.status,
      reviewNotes: po.reviewNotes,
      reviewedBy: po.reviewedBy,
      reviewedAt: po.reviewedAt,
      createdAt: po.createdAt,
      updatedAt: po.updatedAt,
      prescription: po.prescription
        ? {
            id: po.prescription.id,
            prescriptionId: po.prescription.prescriptionId,
            status: po.prescription.status,
            practitioner: po.prescription.practitioner
              ? {
                  id: po.prescription.practitioner.id,
                  email: po.prescription.practitioner.email,
                  fullName:
                    po.prescription.practitioner.profile?.fullName || "Unknown",
                  licenseNumber:
                    po.prescription.practitioner.profile?.licenseNumber || null,
                }
              : null,
          }
        : null,
      pharmacy: po.pharmacy
        ? {
            id: po.pharmacy.id,
            name: po.pharmacy.name,
            address: po.pharmacy.address,
          }
        : null,
    };
  }

  /**
   * Validate prescription items before PO generation
   */
  private async validatePrescriptionItems(
    prescriptionId: string,
    submittedItems: PrescriptionPOItem[],
  ) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        medicines: {
          include: {
            medicine: true,
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException("处方不存在");
    }

    // Validate that all submitted items exist in the prescription
    for (const item of submittedItems) {
      const prescriptionMedicine = prescription.medicines.find(
        (pm) => pm.medicineId === item.medicineId,
      );

      if (!prescriptionMedicine) {
        throw new BadRequestException(`药品 ${item.medicineName} 不在处方中`);
      }

      // Validate quantity doesn't exceed prescription
      if (item.weight > Number(prescriptionMedicine.weight)) {
        throw new BadRequestException(
          `药品 ${item.medicineName} 数量超出处方限制`,
        );
      }
    }

    return true;
  }

  /**
   * Get GST calculation summary for audit purposes
   */
  getGSTSummary(items: PrescriptionPOItem[]) {
    // If items don't have GST calculated yet, calculate them first
    const needsCalculation =
      !items.length ||
      items.some(
        (item) =>
          item.gstAmount === undefined ||
          item.netAmount === undefined ||
          item.gstAmount === 0 ||
          item.netAmount === 0,
      );

    const processedItems = needsCalculation
      ? this.calculateGSTForItems(items)
      : items;

    const totalNet = processedItems.reduce(
      (sum, item) => sum + item.netAmount,
      0,
    );
    const totalGST = processedItems.reduce(
      (sum, item) => sum + item.gstAmount,
      0,
    );
    const totalGross = totalNet + totalGST;

    return {
      gstRate: this.GST_RATE,
      gstRatePercentage: `${(this.GST_RATE * 100).toFixed(1)}%`,
      netAmount: Number(totalNet.toFixed(2)),
      gstAmount: Number(totalGST.toFixed(2)),
      grossAmount: Number(totalGross.toFixed(2)),
      calculatedAt: new Date().toISOString(),
      compliance: "NZ_IRD_GST_ACT",
    };
  }
}
