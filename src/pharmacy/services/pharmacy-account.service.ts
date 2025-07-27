import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WebSocketEventEmitterService } from "../../common/services/websocket-event-emitter.service";

export interface WithdrawalRequestDto {
  purchaseOrderIds: string[];
  bankDetails: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    swiftCode?: string;
  };
  notes?: string;
}

@Injectable()
export class PharmacyAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketEventEmitter: WebSocketEventEmitterService,
  ) {}

  /**
   * 获取或创建药房账户
   */
  async getOrCreateAccount(pharmacyId: string) {
    let account = await this.prisma.pharmacyAccount.findUnique({
      where: { pharmacyId },
    });

    if (!account) {
      account = await this.prisma.pharmacyAccount.create({
        data: {
          pharmacyId,
          balance: 0,
          pendingAmount: 0,
          status: "active",
        },
      });
    }

    return account;
  }

  /**
   * 获取余额信息
   */
  async getBalance(pharmacyId: string) {
    try {
      const account = await this.getOrCreateAccount(pharmacyId);

      // 计算可提现金额（余额 - 待处理金额）
      const availableForWithdrawal =
        Number(account.balance) - Number(account.pendingAmount);

      // 获取最后一笔交易时间
      const lastTransaction =
        await this.prisma.pharmacyAccountTransaction.findFirst({
          where: { accountId: account.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });

      return {
        success: true,
        data: {
          accountId: account.id,
          balance: Number(account.balance),
          currency: "NZD",
          pendingAmount: Number(account.pendingAmount),
          availableForWithdrawal: Math.max(0, availableForWithdrawal),
          lastTransactionAt: lastTransaction?.createdAt,
          status: account.status,
        },
      };
    } catch (error) {
      throw new BadRequestException(`获取余额信息失败: ${error.message}`);
    }
  }

  /**
   * 获取交易记录
   */
  async getTransactionHistory(
    pharmacyId: string,
    options: {
      type?: "CREDIT" | "DEBIT";
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    try {
      const account = await this.getOrCreateAccount(pharmacyId);
      const { type, startDate, endDate, page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;

      // 构建查询条件
      const whereClause: any = { accountId: account.id };

      if (type) {
        whereClause.transactionType = type;
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

      const [transactions, total] = await Promise.all([
        this.prisma.pharmacyAccountTransaction.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        this.prisma.pharmacyAccountTransaction.count({
          where: whereClause,
        }),
      ]);

      const formattedTransactions = transactions.map((txn) => ({
        id: txn.id,
        type: txn.transactionType,
        amount: Number(txn.amount),
        balanceBefore: Number(txn.balanceBefore),
        balanceAfter: Number(txn.balanceAfter),
        referenceType: txn.referenceType,
        referenceId: txn.referenceId,
        description: txn.description,
        createdAt: txn.createdAt,
      }));

      return {
        success: true,
        data: formattedTransactions,
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
      throw new BadRequestException(`获取交易记录失败: ${error.message}`);
    }
  }

  /**
   * 处理采购订单结算（管理员审核通过后调用）
   */
  async processPurchaseOrderSettlement(
    pharmacyId: string,
    purchaseOrderId: string,
    amount: number,
    adminId: string,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      try {
        // 1. 获取账户
        const account = await tx.pharmacyAccount.findUnique({
          where: { pharmacyId },
        });

        if (!account) {
          throw new NotFoundException("药房账户不存在");
        }

        // 2. 计算新余额
        const currentBalance = Number(account.balance);
        const newBalance = currentBalance + amount;

        // 3. 更新账户余额
        await tx.pharmacyAccount.update({
          where: { id: account.id },
          data: {
            balance: newBalance,
            version: { increment: 1 },
          },
        });

        // 4. 创建交易记录
        const transaction = await tx.pharmacyAccountTransaction.create({
          data: {
            accountId: account.id,
            transactionType: "CREDIT",
            amount,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            referenceType: "PURCHASE_ORDER",
            referenceId: purchaseOrderId,
            description: `采购订单结算 - ${purchaseOrderId}`,
            createdBy: adminId,
          },
        });

        // 5. 发送实时通知
        await this.sendBalanceUpdateNotification(pharmacyId, {
          newBalance,
          changeAmount: amount,
          changeType: "CREDIT",
          reason: "purchase_order_settlement",
        });

        return transaction;
      } catch (error) {
        throw new BadRequestException(`处理采购订单结算失败: ${error.message}`);
      }
    });
  }

  /**
   * 申请提现
   */
  async requestWithdrawal(
    pharmacyId: string,
    withdrawalData: WithdrawalRequestDto,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      try {
        const { purchaseOrderIds, bankDetails, notes } = withdrawalData;

        // 1. 验证采购订单
        const purchaseOrders = await tx.purchaseOrder.findMany({
          where: {
            id: { in: purchaseOrderIds },
            pharmacyId,
            status: "approved",
          },
        });

        if (purchaseOrders.length !== purchaseOrderIds.length) {
          throw new BadRequestException("部分采购订单不存在或状态不正确");
        }

        // 2. 检查是否已在其他提现申请中
        const existingWithdrawals = await tx.withdrawalRequest.findMany({
          where: {
            purchaseOrderIds: {
              array_contains: purchaseOrderIds,
            },
            status: {
              in: ["pending_review", "approved"],
            },
          },
        });

        if (existingWithdrawals.length > 0) {
          throw new BadRequestException("部分采购订单已在其他提现申请中");
        }

        // 3. 计算总金额
        const totalAmount = purchaseOrders.reduce(
          (sum, po) => sum + Number(po.totalAmount),
          0,
        );

        // 4. 生成发票编号
        const invoiceNumber = await this.generateInvoiceNumber();

        // 5. 创建提现申请
        const withdrawalRequest = await tx.withdrawalRequest.create({
          data: {
            pharmacyId,
            invoiceNumber,
            purchaseOrderIds,
            totalAmount,
            bankDetails,
            notes,
            status: "pending_review",
          },
        });

        // 6. 更新账户待处理金额
        const account = await this.getOrCreateAccount(pharmacyId);
        await tx.pharmacyAccount.update({
          where: { id: account.id },
          data: {
            pendingAmount: {
              increment: totalAmount,
            },
          },
        });

        // 7. 发送通知给管理员
        await this.sendWithdrawalNotification(withdrawalRequest);

        return {
          success: true,
          data: {
            withdrawalId: withdrawalRequest.id,
            invoiceNumber: withdrawalRequest.invoiceNumber,
            totalAmount,
            purchaseOrderCount: purchaseOrders.length,
            status: withdrawalRequest.status,
            estimatedProcessingDays: 3,
            createdAt: withdrawalRequest.createdAt,
          },
        };
      } catch (error) {
        throw new BadRequestException(`申请提现失败: ${error.message}`);
      }
    });
  }

  /**
   * 获取提现记录
   */
  async getWithdrawalHistory(
    pharmacyId: string,
    options: {
      status?: "pending_review" | "approved" | "rejected" | "completed";
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

      const [withdrawals, total] = await Promise.all([
        this.prisma.withdrawalRequest.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        this.prisma.withdrawalRequest.count({
          where: whereClause,
        }),
      ]);

      const formattedWithdrawals = withdrawals.map((withdrawal) => ({
        id: withdrawal.id,
        invoiceNumber: withdrawal.invoiceNumber,
        totalAmount: Number(withdrawal.totalAmount),
        status: withdrawal.status,
        purchaseOrderCount: (withdrawal.purchaseOrderIds as string[]).length,
        processedAt: withdrawal.processedAt,
        createdAt: withdrawal.createdAt,
        notes: withdrawal.notes,
      }));

      return {
        success: true,
        data: formattedWithdrawals,
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
      throw new BadRequestException(`获取提现记录失败: ${error.message}`);
    }
  }

  /**
   * 处理提现完成（管理员标记已转账后调用）
   */
  async processWithdrawalCompletion(withdrawalId: string, adminId: string) {
    return await this.prisma.$transaction(async (tx) => {
      try {
        // 1. 获取提现申请
        const withdrawal = await tx.withdrawalRequest.findUnique({
          where: { id: withdrawalId },
        });

        if (!withdrawal) {
          throw new NotFoundException("提现申请不存在");
        }

        if (withdrawal.status !== "approved") {
          throw new BadRequestException("提现申请状态不正确");
        }

        // 2. 更新提现状态
        await tx.withdrawalRequest.update({
          where: { id: withdrawalId },
          data: {
            status: "completed",
            processedAt: new Date(),
            processedBy: adminId,
          },
        });

        // 3. 更新账户待处理金额
        const account = await tx.pharmacyAccount.findUnique({
          where: { pharmacyId: withdrawal.pharmacyId },
        });

        if (account) {
          await tx.pharmacyAccount.update({
            where: { id: account.id },
            data: {
              pendingAmount: {
                decrement: Number(withdrawal.totalAmount),
              },
            },
          });

          // 4. 创建提现交易记录
          await tx.pharmacyAccountTransaction.create({
            data: {
              accountId: account.id,
              transactionType: "DEBIT",
              amount: Number(withdrawal.totalAmount),
              balanceBefore: Number(account.balance),
              balanceAfter: Number(account.balance), // 余额不变，只是从待处理转为已处理
              referenceType: "WITHDRAWAL",
              referenceId: withdrawalId,
              description: `提现完成 - ${withdrawal.invoiceNumber}`,
              createdBy: adminId,
            },
          });
        }

        // 5. 发送完成通知
        await this.sendWithdrawalCompletionNotification(withdrawal);

        return withdrawal;
      } catch (error) {
        throw new BadRequestException(`处理提现完成失败: ${error.message}`);
      }
    });
  }

  /**
   * 生成发票编号
   */
  private async generateInvoiceNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

    const count = await this.prisma.withdrawalRequest.count({
      where: {
        invoiceNumber: {
          startsWith: `INV-${dateStr}`,
        },
      },
    });

    const sequence = (count + 1).toString().padStart(3, "0");
    return `INV-${dateStr}-${sequence}`;
  }

  /**
   * 发送余额更新通知
   */
  private async sendBalanceUpdateNotification(pharmacyId: string, data: any) {
    try {
      await this.websocketEventEmitter.emitStandardEvent(
        "account.settlement",
        pharmacyId,
        {
          eventType: "balance.updated",
          data,
          timestamp: new Date().toISOString(),
        },
      );
    } catch (error) {
      console.error("发送余额更新通知失败:", error);
    }
  }

  /**
   * 发送提现申请通知
   */
  private async sendWithdrawalNotification(withdrawal: any) {
    try {
      // 通知管理员
      await this.websocketEventEmitter.emitStandardEvent(
        "withdrawal.requested",
        "admin",
        {
          eventType: "withdrawal.pending_review",
          data: {
            withdrawalId: withdrawal.id,
            pharmacyId: withdrawal.pharmacyId,
            invoiceNumber: withdrawal.invoiceNumber,
            totalAmount: withdrawal.totalAmount,
          },
          timestamp: new Date().toISOString(),
        },
      );
    } catch (error) {
      console.error("发送提现申请通知失败:", error);
    }
  }

  /**
   * 发送提现完成通知
   */
  private async sendWithdrawalCompletionNotification(withdrawal: any) {
    try {
      await this.websocketEventEmitter.emitStandardEvent(
        "withdrawal.processed",
        withdrawal.pharmacyId,
        {
          eventType: "withdrawal.completed",
          data: {
            withdrawalId: withdrawal.id,
            amount: withdrawal.totalAmount,
            processedAt: withdrawal.processedAt,
          },
          timestamp: new Date().toISOString(),
        },
      );
    } catch (error) {
      console.error("发送提现完成通知失败:", error);
    }
  }
}
