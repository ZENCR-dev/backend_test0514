import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateClinicAccountDto } from "../dto/create-clinic-account.dto";
import { UpdateClinicAccountDto } from "../dto/update-clinic-account.dto";
import { QueryClinicAccountDto } from "../dto/query-clinic-account.dto";
import {
  ClinicAccountResponseDto,
  ClinicAccountListResponseDto,
  BalanceResponseDto,
} from "../dto/clinic-account-response.dto";
import { AccountStatus, TransactionType, ReferenceType } from "@prisma/client";

@Injectable()
export class ClinicAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createDto: CreateClinicAccountDto,
  ): Promise<ClinicAccountResponseDto> {
    try {
      // 检查诊所是否已存在账户
      const existingAccount = await this.prisma.clinicAccount.findFirst({
        where: {
          clinicId: createDto.clinicId,
          status: {
            not: AccountStatus.frozen, // 使用frozen状态模拟软删除
          },
        },
      });

      if (existingAccount) {
        throw new BadRequestException("该诊所已存在账户");
      }

      const account = await this.prisma.clinicAccount.create({
        data: {
          clinicId: createDto.clinicId,
          balance: createDto.initialPrepaidAmount || 0,
          creditLimit: createDto.creditLimit || 0,
          status: createDto.status || AccountStatus.active,
          version: 1,
        },
        include: {
          clinic: true, // 包含诊所信息以获取名称
        },
      });

      return this.mapToResponseDto(account);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException("创建诊所账户失败");
    }
  }

  async findAll(
    queryDto: QueryClinicAccountDto,
    currentUserId?: string,
    userRole?: string,
  ): Promise<ClinicAccountListResponseDto> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      clinicId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = queryDto;
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {
      status: {
        not: AccountStatus.frozen, // 排除被标记为frozen的账户（相当于软删除）
      },
    };

    // 权限控制：practitioner只能查看自己的账户
    if (userRole === "practitioner" && currentUserId) {
      // 这里需要通过用户ID找到对应的诊所ID
      // 临时实现，后续需要完善
      where.clinicId = clinicId;
    }

    if (search) {
      where.clinic = {
        name: {
          contains: search,
          mode: "insensitive",
        },
      };
    }

    if (status) {
      where.status = status;
    }

    if (clinicId) {
      where.clinicId = clinicId;
    }

    const [accounts, total] = await Promise.all([
      this.prisma.clinicAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          clinic: true, // 包含诊所信息
        },
      }),
      this.prisma.clinicAccount.count({ where }),
    ]);

    const data = accounts.map((account) => this.mapToResponseDto(account));
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findOne(id: string): Promise<ClinicAccountResponseDto> {
    const account = await this.prisma.clinicAccount.findFirst({
      where: {
        id,
        status: {
          not: AccountStatus.frozen, // 排除被标记为frozen的账户
        },
      },
      include: {
        clinic: true, // 包含诊所信息
      },
    });

    if (!account) {
      throw new NotFoundException("诊所账户不存在");
    }

    return this.mapToResponseDto(account);
  }

  async update(
    id: string,
    updateDto: UpdateClinicAccountDto,
  ): Promise<ClinicAccountResponseDto> {
    const existingAccount = await this.findOne(id);

    try {
      const updatedAccount = await this.prisma.clinicAccount.update({
        where: {
          id,
          version: existingAccount.version, // 乐观锁：检查版本号
        },
        data: {
          ...updateDto,
          version: { increment: 1 }, // 版本号自增
          updatedAt: new Date(),
        },
        include: {
          clinic: true, // 包含诊所信息
        },
      });

      return this.mapToResponseDto(updatedAccount);
    } catch (error) {
      // 处理乐观锁冲突 (Prisma P2034 错误)
      if (error.code === "P2034" || error.code === "P2025") {
        throw new BadRequestException("账户信息已被其他操作更新，请刷新后重试");
      }
      throw new BadRequestException("更新诊所账户失败");
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    const existingAccount = await this.findOne(id);

    try {
      await this.prisma.clinicAccount.update({
        where: {
          id,
          version: existingAccount.version, // 乐观锁：检查版本号
        },
        data: {
          status: AccountStatus.frozen, // 使用frozen状态标记为已删除
          version: { increment: 1 }, // 版本号自增
          updatedAt: new Date(),
        },
      });

      return { message: "诊所账户删除成功" };
    } catch (error) {
      // 处理乐观锁冲突
      if (error.code === "P2034" || error.code === "P2025") {
        throw new BadRequestException("账户信息已被其他操作更新，请刷新后重试");
      }
      throw new BadRequestException("删除诊所账户失败");
    }
  }

  async getBalance(
    id: string,
    currentUserId?: string,
    userRole?: string,
  ): Promise<BalanceResponseDto> {
    const account = await this.findOne(id);

    // 权限检查：practitioner只能查看自己诊所的余额
    if (userRole === "practitioner" && currentUserId) {
      const hasAccess = await this.checkAccountAccess(
        id,
        currentUserId,
        userRole,
      );
      if (!hasAccess) {
        throw new BadRequestException("无权访问该账户");
      }
    }

    return {
      accountId: account.id,
      prepaidBalance: account.prepaidBalance,
      creditLimit: account.creditLimit,
      availableBalance: account.availableBalance,
      status: account.status,
      queriedAt: new Date(),
    };
  }

  // 重新设计权限检查逻辑，基于诊所所有者关系
  async checkAccountAccess(
    accountId: string,
    userId: string,
    userRole: string,
  ): Promise<boolean> {
    if (userRole === "admin") {
      return true; // admin可以访问所有账户
    }

    if (userRole === "practitioner") {
      // 查询账户对应的诊所信息
      const account = await this.prisma.clinicAccount.findUnique({
        where: { id: accountId },
        include: {
          clinic: true, // 包含诊所信息
        },
      });

      if (!account) {
        return false;
      }

      // 检查用户是否是该诊所的所有者
      return account.clinic.ownerId === userId;
    }

    return false; // 其他角色无权访问
  }

  private mapToResponseDto(account: any): ClinicAccountResponseDto {
    return {
      id: account.id,
      clinicName: account.clinic?.name || "Unknown Clinic", // 从关联的clinic获取名称
      clinicId: account.clinicId,
      prepaidBalance: parseFloat(account.balance?.toString() || "0"), // 使用balance字段
      creditLimit: parseFloat(account.creditLimit?.toString() || "0"),
      availableBalance:
        parseFloat((account.balance || 0).toString()) +
        parseFloat((account.creditLimit || 0).toString()),
      status: account.status,
      version: account.version,
      notes: account.notes || "",
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  /**
   * A1前置修复：支付相关的余额操作方法
   * Task 5B - ACCOUNT-02 余额扣款原子操作
   */

  /**
   * 更新账户余额（通用方法）
   * @param clinicId 诊所ID
   * @param amount 变更金额（正数为增加，负数为减少）
   * @param transactionType 交易类型
   * @param referenceId 关联ID（如订单ID、支付ID等）
   * @param description 交易描述
   */
  async updateBalance(
    clinicId: string,
    amount: number,
    transactionType: string,
    referenceId?: string,
    description?: string,
  ): Promise<ClinicAccountResponseDto> {
    // 参数验证
    if (!clinicId || typeof amount !== "number" || isNaN(amount)) {
      throw new BadRequestException("无效的参数：clinicId和amount为必填项");
    }

    if (amount === 0) {
      throw new BadRequestException("金额变更不能为0");
    }

    // 映射交易类型到Prisma枚举
    const prismaTransactionType = this.mapTransactionType(
      transactionType,
      amount,
    );
    const referenceType = this.mapReferenceType(transactionType);

    // 使用事务确保原子性
    return await this.prisma.$transaction(async (tx) => {
      // 查询当前账户状态（加锁）
      const account = await tx.clinicAccount.findFirst({
        where: {
          clinicId,
          status: {
            not: AccountStatus.frozen,
          },
        },
        include: {
          clinic: true,
        },
      });

      if (!account) {
        throw new NotFoundException("诊所账户不存在或已被冻结");
      }

      // 检查余额是否足够（仅当扣款时）
      if (amount < 0) {
        const currentBalance = parseFloat(account.balance.toString());
        const availableBalance =
          currentBalance + parseFloat(account.creditLimit.toString());

        if (availableBalance + amount < 0) {
          throw new BadRequestException(
            `余额不足：当前可用余额 ${availableBalance}，尝试扣款 ${Math.abs(amount)}`,
          );
        }
      }

      // 计算新余额
      const currentBalance = parseFloat(account.balance.toString());
      const newBalance = currentBalance + amount;

      // 使用乐观锁更新账户余额
      const updatedAccount = await tx.clinicAccount.update({
        where: {
          id: account.id,
          version: account.version, // 乐观锁检查
        },
        data: {
          balance: newBalance,
          version: { increment: 1 }, // 版本号自增
          updatedAt: new Date(),
        },
        include: {
          clinic: true,
        },
      });

      // 创建交易记录
      await tx.accountTransaction.create({
        data: {
          accountId: account.id,
          transactionType: prismaTransactionType,
          amount: amount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          creditBefore: parseFloat(account.usedCredit.toString()),
          creditAfter: parseFloat(account.usedCredit.toString()), // 暂时不变
          referenceType: referenceType,
          referenceId: referenceId || null,
          description: description || `${transactionType}交易`,
          createdBy: null, // TODO: 从上下文获取用户ID
        },
      });

      return this.mapToResponseDto(updatedAccount);
    });
  }

  /**
   * 扣除账户余额（支付使用）
   * @param clinicId 诊所ID
   * @param amount 扣款金额（正数）
   * @param referenceId 关联ID（如订单ID）
   * @param description 交易描述
   */
  async deductBalance(
    clinicId: string,
    amount: number,
    referenceId?: string,
    description?: string,
  ): Promise<ClinicAccountResponseDto> {
    if (amount <= 0) {
      throw new BadRequestException("扣款金额必须大于0");
    }

    return await this.updateBalance(
      clinicId,
      -amount, // 转换为负数
      "deduct",
      referenceId,
      description || `扣款：${amount}`,
    );
  }

  /**
   * 退款到账户（退款使用）
   * @param clinicId 诊所ID
   * @param amount 退款金额（正数）
   * @param referenceId 关联ID（如订单ID、支付ID）
   * @param description 交易描述
   */
  async refundBalance(
    clinicId: string,
    amount: number,
    referenceId?: string,
    description?: string,
  ): Promise<ClinicAccountResponseDto> {
    if (amount <= 0) {
      throw new BadRequestException("退款金额必须大于0");
    }

    return await this.updateBalance(
      clinicId,
      amount, // 正数，增加余额
      "refund",
      referenceId,
      description || `退款：${amount}`,
    );
  }

  /**
   * 获取账户交易记录
   * @param accountId 账户ID
   * @param page 页码
   * @param limit 每页数量
   */
  async getTransactionHistory(
    accountId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: any[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.accountTransaction.findMany({
        where: {
          accountId,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      }),
      this.prisma.accountTransaction.count({
        where: {
          accountId,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: transactions.map((tx) => ({
        id: tx.id,
        amount: parseFloat(tx.amount.toString()),
        transactionType: tx.transactionType,
        referenceId: tx.referenceId,
        referenceType: tx.referenceType,
        description: tx.description,
        balanceBefore: parseFloat(tx.balanceBefore.toString()),
        balanceAfter: parseFloat(tx.balanceAfter.toString()),
        creditBefore: parseFloat(tx.creditBefore.toString()),
        creditAfter: parseFloat(tx.creditAfter.toString()),
        createdAt: tx.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * 映射交易类型到Prisma枚举
   */
  private mapTransactionType(
    transactionType: string,
    amount: number,
  ): TransactionType {
    switch (transactionType.toLowerCase()) {
      case "deduct":
      case "payment":
        return TransactionType.DEBIT;
      case "deposit":
      case "recharge":
        return TransactionType.CREDIT;
      case "refund":
        return TransactionType.REFUND;
      case "adjustment":
        return TransactionType.ADJUSTMENT;
      default:
        // 根据金额判断
        return amount < 0 ? TransactionType.DEBIT : TransactionType.CREDIT;
    }
  }

  /**
   * 映射参考类型到Prisma枚举
   */
  private mapReferenceType(transactionType: string): ReferenceType | null {
    switch (transactionType.toLowerCase()) {
      case "deduct":
      case "payment":
        return ReferenceType.ORDER;
      case "deposit":
      case "recharge":
        return ReferenceType.RECHARGE;
      case "refund":
        return ReferenceType.REFUND;
      case "adjustment":
        return ReferenceType.MANUAL;
      default:
        return null;
    }
  }
}
