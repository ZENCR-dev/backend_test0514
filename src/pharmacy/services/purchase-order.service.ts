import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PriceListService } from "./price-list.service";

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceListService: PriceListService,
  ) {}

  /**
   * 自动生成采购订单
   */
  async generatePurchaseOrder(
    pharmacyId: string,
    orderId: string,
    fulfillmentProofId: string,
    orderItems: any[],
    tx?: any, // 事务对象
  ) {
    const prisma = tx || this.prisma;

    try {
      // 1. 生成PO编号
      const poNumber = await this.generatePONumber();

      // 2. 获取药房当前价目表
      const priceList =
        await this.priceListService.getCurrentPriceList(pharmacyId);
      if (!priceList) {
        throw new BadRequestException("药房未设置价目表，无法生成采购订单");
      }

      // 3. 计算每个药品的价格和数量
      const poItems = await this.calculatePOItems(
        orderItems,
        priceList.data.items,
      );

      // 4. 计算总金额
      const totalAmount = poItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0,
      );

      // 5. 创建采购订单
      const purchaseOrder = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          pharmacyId,
          orderId,
          fulfillmentProofId,
          items: poItems,
          totalAmount,
          status: "pending_review",
          metadata: {
            priceListId: priceList.data.priceListId,
            priceListVersion: priceList.data.version,
            generatedAt: new Date().toISOString(),
            calculationMethod: "pharmacy_price_list",
          },
        },
      });

      return purchaseOrder;
    } catch (error) {
      throw new BadRequestException(`生成采购订单失败: ${error.message}`);
    }
  }

  /**
   * 获取采购订单列表
   */
  async getPurchaseOrders(
    pharmacyId: string,
    options: {
      status?: "pending_review" | "approved" | "rejected" | "paid";
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    try {
      const { status, startDate, endDate, page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;

      // 构建查询条件
      const whereClause: any = { pharmacyId };

      if (status) {
        whereClause.status = status;
      }

      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) {
          whereClause.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          whereClause.createdAt.lte = new Date(endDate);
        }
      }

      const [orders, total] = await Promise.all([
        this.prisma.purchaseOrder.findMany({
          where: whereClause,
          include: {
            order: {
              select: {
                platformOrderId: true,
                patientId: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
        this.prisma.purchaseOrder.count({
          where: whereClause,
        }),
      ]);

      const formattedOrders = orders.map((po) => ({
        id: po.id,
        poNumber: po.poNumber,
        orderId: po.orderId,
        platformOrderId: po.orderId,
        patientName: "未知患者",
        items: this.formatPOItems(po.items as any[]),
        totalAmount: po.totalAmount,
        status: po.status,
        createdAt: po.createdAt,
        approvedAt: po.reviewedAt,
      }));

      return {
        success: true,
        data: formattedOrders,
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
      throw new BadRequestException(`获取采购订单列表失败: ${error.message}`);
    }
  }

  /**
   * 获取采购订单详情
   */
  async getPurchaseOrderDetail(poId: string, pharmacyId: string) {
    try {
      const purchaseOrder = await this.prisma.purchaseOrder.findFirst({
        where: {
          id: poId,
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
          fulfillmentProof: {
            select: {
              id: true,
              proofFiles: true,
              createdAt: true,
            },
          },
        },
      });

      if (!purchaseOrder) {
        throw new NotFoundException("采购订单不存在");
      }

      return {
        success: true,
        data: {
          id: purchaseOrder.id,
          poNumber: purchaseOrder.poNumber,
          orderId: purchaseOrder.orderId,
          platformOrderId: purchaseOrder.order.platformOrderId,
          fulfillmentProofId: purchaseOrder.fulfillmentProofId,
          fulfillmentProof: purchaseOrder.fulfillmentProof,
          items: this.formatDetailedPOItems(
            purchaseOrder.items as any[],
            purchaseOrder.order.items,
          ),
          totalAmount: purchaseOrder.totalAmount,
          status: purchaseOrder.status,
          reviewNotes: purchaseOrder.reviewNotes,
          createdAt: purchaseOrder.createdAt,
          approvedAt: purchaseOrder.reviewedAt,
          metadata: (purchaseOrder as any).metadata,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`获取采购订单详情失败: ${error.message}`);
    }
  }

  /**
   * 获取可提现的采购订单
   */
  async getWithdrawablePurchaseOrders(pharmacyId: string) {
    try {
      const orders = await this.prisma.purchaseOrder.findMany({
        where: {
          pharmacyId,
          status: "approved",
          // 只查询已批准的采购订单
        },
        select: {
          id: true,
          poNumber: true,
          totalAmount: true,
          createdAt: true,
          reviewedAt: true,
        },
        orderBy: {
          reviewedAt: "desc",
        },
      });

      return {
        success: true,
        data: orders.map((po) => ({
          id: po.id,
          poNumber: po.poNumber,
          amount: po.totalAmount,
          approvedAt: po.reviewedAt,
          selected: false, // 前端用于选择
        })),
      };
    } catch (error) {
      throw new BadRequestException(`获取可提现采购订单失败: ${error.message}`);
    }
  }

  /**
   * 计算PO项目价格
   */
  private async calculatePOItems(orderItems: any[], priceListItems: any[]) {
    const poItems = [];

    for (const orderItem of orderItems) {
      // 从价目表中查找对应药品的价格
      const priceItem = priceListItems.find(
        (item) => item.medicineId === orderItem.medicineId,
      );

      if (!priceItem) {
        throw new BadRequestException(
          `药品 ${orderItem.medicine.name} 在价目表中未找到`,
        );
      }

      if (!priceItem.inStock) {
        throw new BadRequestException(
          `药品 ${orderItem.medicine.name} 当前缺货`,
        );
      }

      // 计算帖数（假设每帖7天的量）
      const doses = Math.ceil(orderItem.quantity / 7);

      // 计算总价：单价 × 克重 × 帖数
      const totalPrice = Number(
        (priceItem.unitPrice * orderItem.quantity * doses).toFixed(2),
      );

      poItems.push({
        medicineId: orderItem.medicineId,
        medicineName: orderItem.medicine.name,
        quantity: orderItem.quantity,
        doses,
        unitPrice: priceItem.unitPrice,
        totalPrice,
        priceSource: "pharmacy_price_list",
        calculatedAt: new Date().toISOString(),
      });
    }

    return poItems;
  }

  /**
   * 生成PO编号
   */
  private async generatePONumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

    // 查找今天已生成的PO数量
    const count = await this.prisma.purchaseOrder.count({
      where: {
        poNumber: {
          startsWith: `PO-${dateStr}`,
        },
      },
    });

    const sequence = (count + 1).toString().padStart(3, "0");
    return `PO-${dateStr}-${sequence}`;
  }

  /**
   * 格式化PO项目（列表显示）
   */
  private formatPOItems(items: any[]) {
    return items.map((item) => ({
      medicineName: item.medicineName,
      quantity: item.quantity,
      doses: item.doses,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));
  }

  /**
   * 格式化详细PO项目（详情显示）
   */
  private formatDetailedPOItems(poItems: any[], orderItems: any[]) {
    return poItems.map((poItem) => {
      const orderItem = orderItems.find(
        (oi) => oi.medicineId === poItem.medicineId,
      );

      return {
        medicineId: poItem.medicineId,
        medicineName: poItem.medicineName,
        quantity: poItem.quantity,
        doses: poItem.doses,
        unitPrice: poItem.unitPrice,
        totalPrice: poItem.totalPrice,
        priceSource: poItem.priceSource,
        dosageInstructions: orderItem?.dosageInstructions,
        originalUnitPrice: orderItem?.unitPrice, // 原始处方价格
      };
    });
  }
}
