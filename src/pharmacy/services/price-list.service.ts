import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface PriceListUploadDto {
  effectiveDate: string;
  items: Array<{
    medicineId: string;
    unitPrice: number;
    inStock: boolean;
  }>;
  notes?: string;
}

@Injectable()
export class PriceListService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 上传价目表
   */
  async uploadPriceList(pharmacyId: string, priceListData: PriceListUploadDto) {
    try {
      const { effectiveDate, items, notes } = priceListData;

      // 1. 验证生效日期（必须至少7天后）
      const effectiveDateObj = new Date(effectiveDate);
      const minDate = new Date();
      minDate.setDate(minDate.getDate() + 7);

      if (effectiveDateObj < minDate) {
        throw new BadRequestException("生效日期必须至少为提交日期后7天");
      }

      // 2. 验证药品存在性
      const medicineIds = items.map((item) => item.medicineId);
      const existingMedicines = await this.prisma.medicine.findMany({
        where: {
          id: { in: medicineIds },
          status: "active",
        },
        select: { id: true, name: true },
      });

      if (existingMedicines.length !== medicineIds.length) {
        const existingIds = existingMedicines.map((m) => m.id);
        const missingIds = medicineIds.filter(
          (id) => !existingIds.includes(id),
        );
        throw new BadRequestException(
          `以下药品不存在或已停用: ${missingIds.join(", ")}`,
        );
      }

      // 3. 检查是否已有待审核的价目表
      const pendingPriceList = await this.prisma.pharmacyPriceList.findFirst({
        where: {
          pharmacyId,
          status: "pending_approval",
        },
      });

      if (pendingPriceList) {
        throw new BadRequestException(
          "已有待审核的价目表，请等待审核完成后再提交新版本",
        );
      }

      // 4. 获取下一个版本号
      const latestVersion = await this.prisma.pharmacyPriceList.findFirst({
        where: { pharmacyId },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const nextVersion = (latestVersion?.version || 0) + 1;

      // 5. 格式化价目表项目
      const formattedItems = items.map((item) => ({
        medicineId: item.medicineId,
        medicineName: existingMedicines.find((m) => m.id === item.medicineId)
          ?.name,
        unitPrice: Number(item.unitPrice.toFixed(2)),
        inStock: item.inStock,
        updatedAt: new Date().toISOString(),
      }));

      // 6. 创建价目表记录
      const priceList = await this.prisma.pharmacyPriceList.create({
        data: {
          pharmacyId,
          version: nextVersion,
          effectiveDate: effectiveDateObj,
          items: formattedItems,
          status: "pending_approval",
          notes,
        },
      });

      return {
        success: true,
        data: {
          priceListId: priceList.id,
          version: priceList.version,
          effectiveDate: priceList.effectiveDate,
          status: priceList.status,
          itemCount: formattedItems.length,
          createdAt: priceList.createdAt,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`上传价目表失败: ${error.message}`);
    }
  }

  /**
   * 获取当前生效的价目表
   */
  async getCurrentPriceList(pharmacyId: string) {
    try {
      const priceList = await this.prisma.pharmacyPriceList.findFirst({
        where: {
          pharmacyId,
          status: "active",
          effectiveDate: {
            lte: new Date(),
          },
        },
        orderBy: {
          effectiveDate: "desc",
        },
      });

      if (!priceList) {
        return null;
      }

      const items = (priceList.items as any[]).map((item) => ({
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        unitPrice: Number(item.unitPrice),
        inStock: item.inStock,
        lastUpdated: item.updatedAt,
      }));

      return {
        success: true,
        data: {
          priceListId: priceList.id,
          version: priceList.version,
          effectiveDate: priceList.effectiveDate,
          status: priceList.status,
          items,
          totalItems: items.length,
          lastUpdated: priceList.updatedAt,
        },
      };
    } catch (error) {
      throw new BadRequestException(`获取当前价目表失败: ${error.message}`);
    }
  }

  /**
   * 获取价目表历史版本
   */
  async getPriceListHistory(
    pharmacyId: string,
    options: {
      status?: "pending_approval" | "active" | "rejected" | "expired";
      page?: number;
      limit?: number;
    },
  ) {
    try {
      const { status, page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;

      const whereClause: any = { pharmacyId };
      if (status) {
        whereClause.status = status;
      }

      const [priceLists, total] = await Promise.all([
        this.prisma.pharmacyPriceList.findMany({
          where: whereClause,
          select: {
            id: true,
            version: true,
            effectiveDate: true,
            status: true,
            notes: true,
            createdAt: true,
            approvedAt: true,
            items: true,
          },
          orderBy: {
            version: "desc",
          },
          skip,
          take: limit,
        }),
        this.prisma.pharmacyPriceList.count({
          where: whereClause,
        }),
      ]);

      const formattedPriceLists = priceLists.map((pl) => ({
        id: pl.id,
        version: pl.version,
        effectiveDate: pl.effectiveDate,
        status: pl.status,
        itemCount: (pl.items as any[]).length,
        notes: pl.notes,
        createdAt: pl.createdAt,
        approvedAt: pl.approvedAt,
      }));

      return {
        success: true,
        data: formattedPriceLists,
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
      throw new BadRequestException(`获取价目表历史失败: ${error.message}`);
    }
  }

  /**
   * 更新单个药品库存状态
   */
  async updateMedicineStock(
    pharmacyId: string,
    medicineId: string,
    updateData: { inStock: boolean; notes?: string },
  ) {
    try {
      // 1. 获取当前生效的价目表
      const currentPriceList = await this.prisma.pharmacyPriceList.findFirst({
        where: {
          pharmacyId,
          status: "active",
          effectiveDate: {
            lte: new Date(),
          },
        },
        orderBy: {
          effectiveDate: "desc",
        },
      });

      if (!currentPriceList) {
        throw new NotFoundException("未找到当前生效的价目表");
      }

      // 2. 更新价目表中的库存状态
      const items = currentPriceList.items as any[];
      const itemIndex = items.findIndex(
        (item) => item.medicineId === medicineId,
      );

      if (itemIndex === -1) {
        throw new NotFoundException("药品在当前价目表中不存在");
      }

      // 更新库存状态
      items[itemIndex] = {
        ...items[itemIndex],
        inStock: updateData.inStock,
        updatedAt: new Date().toISOString(),
      };

      // 3. 保存更新
      await this.prisma.pharmacyPriceList.update({
        where: { id: currentPriceList.id },
        data: {
          items,
          updatedAt: new Date(),
        },
      });

      // 4. 记录库存变更日志
      await this.logStockChange(pharmacyId, medicineId, updateData);

      return {
        success: true,
        data: {
          medicineId,
          medicineName: items[itemIndex].medicineName,
          inStock: updateData.inStock,
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`更新库存状态失败: ${error.message}`);
    }
  }

  /**
   * 批量更新库存状态
   */
  async batchUpdateMedicineStock(
    pharmacyId: string,
    updates: Array<{
      medicineId: string;
      inStock: boolean;
    }>,
  ) {
    try {
      const currentPriceList = await this.prisma.pharmacyPriceList.findFirst({
        where: {
          pharmacyId,
          status: "active",
          effectiveDate: {
            lte: new Date(),
          },
        },
        orderBy: {
          effectiveDate: "desc",
        },
      });

      if (!currentPriceList) {
        throw new NotFoundException("未找到当前生效的价目表");
      }

      const items = currentPriceList.items as any[];
      const updatedItems = [...items];
      const updateResults = [];

      for (const update of updates) {
        const itemIndex = updatedItems.findIndex(
          (item) => item.medicineId === update.medicineId,
        );

        if (itemIndex !== -1) {
          updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            inStock: update.inStock,
            updatedAt: new Date().toISOString(),
          };

          updateResults.push({
            medicineId: update.medicineId,
            medicineName: updatedItems[itemIndex].medicineName,
            inStock: update.inStock,
            success: true,
          });
        } else {
          updateResults.push({
            medicineId: update.medicineId,
            success: false,
            error: "药品在价目表中不存在",
          });
        }
      }

      // 保存更新
      await this.prisma.pharmacyPriceList.update({
        where: { id: currentPriceList.id },
        data: {
          items: updatedItems,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        data: {
          totalUpdates: updates.length,
          successCount: updateResults.filter((r) => r.success).length,
          results: updateResults,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`批量更新库存状态失败: ${error.message}`);
    }
  }

  /**
   * 记录库存变更日志
   */
  private async logStockChange(
    pharmacyId: string,
    medicineId: string,
    updateData: any,
  ) {
    try {
      await this.prisma.eventLog.create({
        data: {
          eventType: "MEDICINE_STOCK_UPDATE",
          payload: {
            pharmacyId,
            medicineId,
            inStock: updateData.inStock,
            notes: updateData.notes,
            timestamp: new Date().toISOString(),
          },
          metadata: {
            source: "price_list_service",
            action: "stock_update",
          },
        },
      });
    } catch (error) {
      console.error("记录库存变更日志失败:", error);
    }
  }
}
