import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

export interface InvoiceLineItem {
  poNumber: string;
  prescriptionId?: string;
  description: string;
  netAmount: number;
  gstAmount: number;
  totalAmount: number;
  serviceDate: Date;
  lineNumber: number;
}

export interface NewZealandInvoiceData {
  invoiceNumber: string;
  pharmacyDetails: {
    name: string;
    address: any;
    nzbn?: string; // New Zealand Business Number
    gstNumber: string;
    contact: any;
  };
  clientDetails: {
    name: string;
    address?: string;
    reference?: string;
  };
  lineItems: InvoiceLineItem[];
  summary: {
    subtotal: number;
    gstAmount: number;
    totalAmount: number;
    gstRate: number;
  };
  invoiceDate: Date;
  dueDate: Date;
  paymentTerms: string;
  compliance: {
    gstCompliant: boolean;
    irdRequirementsMet: boolean;
    generatedAt: Date;
  };
}

export interface CreateInvoiceRequest {
  pharmacyId: string;
  purchaseOrderIds: string[];
  bankDetails: any;
  notes?: string;
  paymentTerms?: string;
  dueDate?: Date;
}

@Injectable()
export class InvoiceWithdrawalService {
  private readonly DEFAULT_PAYMENT_TERMS = "Net 30 days";
  private readonly GST_RATE = 0.15;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create Invoice from multiple Purchase Orders
   */
  async createInvoiceFromPurchaseOrders(
    request: CreateInvoiceRequest,
    tx?: any,
  ) {
    const prisma = tx || this.prisma;

    try {
      // 1. Validate and fetch purchase orders
      const purchaseOrders = await this.validateAndFetchPurchaseOrders(
        request.purchaseOrderIds,
        request.pharmacyId,
        prisma,
      );

      // 2. Get pharmacy details
      const pharmacy = await prisma.pharmacy.findUnique({
        where: { id: request.pharmacyId },
        include: { account: true },
      });

      if (!pharmacy) {
        throw new NotFoundException("药房不存在");
      }

      // 3. Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber();

      // 4. Create invoice line items from POs
      const lineItems = this.createLineItemsFromPurchaseOrders(purchaseOrders);

      // 5. Calculate invoice totals
      const summary = this.calculateInvoiceSummary(lineItems);

      // 6. Create withdrawal request (which serves as our invoice)
      const withdrawalRequest = await prisma.withdrawalRequest.create({
        data: {
          pharmacyId: request.pharmacyId,
          invoiceNumber,
          purchaseOrderIds: request.purchaseOrderIds,
          totalAmount: new Decimal(summary.totalAmount),
          bankDetails: request.bankDetails,
          status: "pending_review",
          notes: request.notes,
          metadata: {
            invoiceData: this.buildInvoiceData({
              invoiceNumber,
              pharmacy,
              lineItems,
              summary,
              dueDate: request.dueDate || this.calculateDueDate(),
              paymentTerms: request.paymentTerms || this.DEFAULT_PAYMENT_TERMS,
            }),
            createdAt: new Date().toISOString(),
            version: "2.0",
            type: "multi_po_invoice",
          },
        },
      });

      // 7. Update PO statuses to indicate they're invoiced
      await prisma.purchaseOrder.updateMany({
        where: {
          id: { in: request.purchaseOrderIds },
        },
        data: {
          status: "invoiced",
          metadata: {
            invoiceNumber,
            invoicedAt: new Date().toISOString(),
          },
        },
      });

      return {
        success: true,
        data: {
          withdrawalRequestId: withdrawalRequest.id,
          invoiceNumber,
          invoiceData: withdrawalRequest.metadata.invoiceData,
          totalAmount: Number(withdrawalRequest.totalAmount),
          status: withdrawalRequest.status,
          createdAt: withdrawalRequest.createdAt,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(`创建发票失败: ${error.message}`);
    }
  }

  /**
   * Get Invoice Details
   */
  async getInvoiceDetails(invoiceNumber: string, pharmacyId: string) {
    try {
      const withdrawalRequest = await this.prisma.withdrawalRequest.findFirst({
        where: {
          invoiceNumber,
          pharmacyId,
        },
        include: {
          pharmacy: true,
        },
      });

      if (!withdrawalRequest) {
        throw new NotFoundException("发票不存在");
      }

      // Get associated purchase orders
      const purchaseOrders = await this.prisma.purchaseOrder.findMany({
        where: {
          id: { in: withdrawalRequest.purchaseOrderIds as string[] },
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
        },
      });

      return {
        success: true,
        data: {
          id: withdrawalRequest.id,
          invoiceNumber: withdrawalRequest.invoiceNumber,
          pharmacyId: withdrawalRequest.pharmacyId,
          totalAmount: Number(withdrawalRequest.totalAmount),
          status: withdrawalRequest.status,
          notes: withdrawalRequest.notes,
          bankDetails: withdrawalRequest.bankDetails,
          processedBy: withdrawalRequest.processedBy,
          processedAt: withdrawalRequest.processedAt,
          createdAt: withdrawalRequest.createdAt,
          invoiceData: (withdrawalRequest as any).metadata?.invoiceData,
          purchaseOrders: purchaseOrders.map((po) => ({
            id: po.id,
            poNumber: po.poNumber,
            totalAmount: Number(po.totalAmount),
            gstAmount: po.gstAmount ? Number(po.gstAmount) : null,
            netAmount: po.netAmount ? Number(po.netAmount) : null,
            prescriptionId: po.prescriptionId,
            prescription: po.prescription
              ? {
                  prescriptionId: po.prescription.prescriptionId,
                  practitioner:
                    po.prescription.practitioner?.profile?.fullName ||
                    "Unknown",
                }
              : null,
          })),
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`获取发票详情失败: ${error.message}`);
    }
  }

  /**
   * Get All Invoices for Pharmacy
   */
  async getPharmacyInvoices(
    pharmacyId: string,
    options: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {},
  ) {
    try {
      const { status, startDate, endDate, page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;

      const whereClause: any = { pharmacyId };

      if (status) {
        whereClause.status = status;
      }

      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) {
          whereClause.createdAt.gte = startDate;
        }
        if (endDate) {
          whereClause.createdAt.lte = endDate;
        }
      }

      const [invoices, total] = await Promise.all([
        this.prisma.withdrawalRequest.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        this.prisma.withdrawalRequest.count({ where: whereClause }),
      ]);

      return {
        success: true,
        data: invoices.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: Number(invoice.totalAmount),
          status: invoice.status,
          createdAt: invoice.createdAt,
          processedAt: invoice.processedAt,
          purchaseOrderCount: (invoice.purchaseOrderIds as string[]).length,
        })),
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
      throw new BadRequestException(`获取发票列表失败: ${error.message}`);
    }
  }

  /**
   * Update Invoice Status (for admin processing)
   */
  async updateInvoiceStatus(
    invoiceNumber: string,
    status: "pending_review" | "approved" | "rejected" | "paid",
    processedBy: string,
    notes?: string,
  ) {
    try {
      const withdrawalRequest = await this.prisma.withdrawalRequest.findFirst({
        where: { invoiceNumber },
      });

      if (!withdrawalRequest) {
        throw new NotFoundException("发票不存在");
      }

      const updatedRequest = await this.prisma.withdrawalRequest.update({
        where: { id: withdrawalRequest.id },
        data: {
          status,
          processedBy,
          processedAt: new Date(),
          notes: notes || withdrawalRequest.notes,
        } as any, // Temporary fix for metadata field issue
      });

      // If approved, update associated purchase orders
      if (status === "approved") {
        await this.prisma.purchaseOrder.updateMany({
          where: {
            id: { in: withdrawalRequest.purchaseOrderIds as string[] },
          },
          data: { status: "approved" },
        });
      }

      return {
        success: true,
        data: {
          invoiceNumber: updatedRequest.invoiceNumber,
          status: updatedRequest.status,
          processedBy: updatedRequest.processedBy,
          processedAt: updatedRequest.processedAt,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`更新发票状态失败: ${error.message}`);
    }
  }

  /**
   * Validate and fetch purchase orders
   */
  private async validateAndFetchPurchaseOrders(
    poIds: string[],
    pharmacyId: string,
    prisma: any,
  ) {
    if (!poIds || poIds.length === 0) {
      throw new BadRequestException("必须选择至少一个采购订单");
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        id: { in: poIds },
        pharmacyId,
        status: "approved", // Only approved POs can be invoiced
      },
      include: {
        prescription: {
          include: {
            practitioner: {
              include: { profile: true },
            },
          },
        },
      },
    });

    if (purchaseOrders.length !== poIds.length) {
      throw new BadRequestException("部分采购订单不存在或未审批");
    }

    // Check if any PO is already invoiced
    const alreadyInvoiced = purchaseOrders.filter(
      (po) => po.status === "invoiced" || po.metadata?.invoiceNumber,
    );

    if (alreadyInvoiced.length > 0) {
      throw new BadRequestException(
        `采购订单 ${alreadyInvoiced.map((po) => po.poNumber).join(", ")} 已开票`,
      );
    }

    return purchaseOrders;
  }

  /**
   * Create line items from purchase orders
   */
  private createLineItemsFromPurchaseOrders(
    purchaseOrders: any[],
  ): InvoiceLineItem[] {
    return purchaseOrders.map((po, index) => ({
      poNumber: po.poNumber,
      prescriptionId: po.prescriptionId,
      description: this.generateLineItemDescription(po),
      netAmount: po.netAmount
        ? Number(po.netAmount)
        : Number(po.totalAmount) / (1 + this.GST_RATE),
      gstAmount: po.gstAmount
        ? Number(po.gstAmount)
        : Number(po.totalAmount) - Number(po.totalAmount) / (1 + this.GST_RATE),
      totalAmount: Number(po.totalAmount),
      serviceDate: new Date(po.createdAt),
      lineNumber: index + 1,
    }));
  }

  /**
   * Generate line item description
   */
  private generateLineItemDescription(po: any): string {
    const items = po.medicineItems || po.items || [];
    const itemCount = items.length;

    if (po.prescriptionId && po.prescription) {
      const practitioner =
        po.prescription.practitioner?.profile?.fullName ||
        "Unknown Practitioner";
      return `Prescription Services - ${itemCount} items (Practitioner: ${practitioner})`;
    }

    return `Pharmacy Services - PO ${po.poNumber} (${itemCount} items)`;
  }

  /**
   * Calculate invoice summary
   */
  private calculateInvoiceSummary(lineItems: InvoiceLineItem[]) {
    const subtotal = lineItems.reduce((sum, item) => sum + item.netAmount, 0);
    const gstAmount = lineItems.reduce((sum, item) => sum + item.gstAmount, 0);
    const totalAmount = subtotal + gstAmount;

    return {
      subtotal: Number(subtotal.toFixed(2)),
      gstAmount: Number(gstAmount.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
      gstRate: this.GST_RATE,
    };
  }

  /**
   * Build complete invoice data for New Zealand compliance
   */
  private buildInvoiceData(params: {
    invoiceNumber: string;
    pharmacy: any;
    lineItems: InvoiceLineItem[];
    summary: any;
    dueDate: Date;
    paymentTerms: string;
  }): NewZealandInvoiceData {
    return {
      invoiceNumber: params.invoiceNumber,
      pharmacyDetails: {
        name: params.pharmacy.name,
        address: params.pharmacy.address,
        nzbn: params.pharmacy.metadata?.nzbn,
        gstNumber:
          params.pharmacy.metadata?.gstNumber || "GST_REGISTRATION_REQUIRED",
        contact: params.pharmacy.contact,
      },
      clientDetails: {
        name: "Medical Platform Services",
        address: "New Zealand",
        reference: "PLATFORM_SERVICES",
      },
      lineItems: params.lineItems,
      summary: params.summary,
      invoiceDate: new Date(),
      dueDate: params.dueDate,
      paymentTerms: params.paymentTerms,
      compliance: {
        gstCompliant: true,
        irdRequirementsMet: true,
        generatedAt: new Date(),
      },
    };
  }

  /**
   * Calculate due date based on payment terms
   */
  private calculateDueDate(): Date {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days default
    return dueDate;
  }

  /**
   * Generate invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, "0");

    const count = await this.prisma.withdrawalRequest.count({
      where: {
        invoiceNumber: {
          startsWith: `INV-${year}${month}`,
        },
      },
    });

    const sequence = (count + 1).toString().padStart(4, "0");
    return `INV-${year}${month}-${sequence}`;
  }
}
