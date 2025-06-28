import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";
import { PractitionerAccount, AccountTransaction } from "@prisma/client";

/**
 * 医师个人账户服务
 * 
 * 职责范围：
 * - 医师个人账户的创建和管理
 * - 账户余额的扣款和退款操作
 * - 交易记录的生成和查询
 * - 并发控制和乐观锁机制
 * 
 * 技术要求：
 * - 使用Prisma事务确保数据一致性
 * - 实现乐观锁版本控制防止并发冲突
 * - 完整的错误处理和日志记录
 */
@Injectable()
export class PractitionerAccountService {
  private readonly logger = new Logger(PractitionerAccountService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建医师个人账户
   * @param practitionerId 医师ID
   * @returns 创建的账户信息
   */
  async createAccount(practitionerId: string): Promise<PractitionerAccount> {
    this.logger.log(`Creating account for practitioner ${practitionerId}`);
    
    try {
      // 输入验证
      if (!practitionerId) {
        throw new BadRequestException("Practitioner ID is required");
      }

      // 检查账户是否已存在
      const existingAccount = await this.prisma.practitionerAccount.findUnique({
        where: { practitionerId },
      });

      if (existingAccount) {
        this.logger.warn(`Account already exists for practitioner ${practitionerId}`);
        return existingAccount;
      }

      // 创建新账户
      const newAccount = await this.prisma.practitionerAccount.create({
        data: {
          practitionerId,
          balance: new Decimal(0),
          creditLimit: new Decimal(0),
          usedCredit: new Decimal(0),
          availableCredit: new Decimal(0),
          status: "active",
          version: 1,
        },
      });

      this.logger.log(`Successfully created account for practitioner ${practitionerId}`);
      return newAccount;
    } catch (error) {
      this.logger.error(`Failed to create account for practitioner ${practitionerId}:`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Failed to create practitioner account: ${error.message}`
      );
    }
  }

  /**
   * 从医师账户扣款
   * @param practitionerId 医师ID
   * @param amount 扣款金额
   * @param orderId 订单ID
   * @param reason 扣款原因
   * @returns 交易记录
   */
  async deductBalance(
    practitionerId: string,
    amount: Decimal,
    orderId: string,
    reason?: string
  ): Promise<AccountTransaction> {
    this.logger.log(`Deducting ${amount} from practitioner ${practitionerId} for order ${orderId}`);
    
    try {
      // 输入验证
      if (!practitionerId) {
        throw new BadRequestException("Practitioner ID is required");
      }
      if (!amount || amount.lte(0)) {
        throw new BadRequestException("Amount must be greater than 0");
      }
      if (!orderId) {
        throw new BadRequestException("Order ID is required");
      }

      const MAX_RETRIES = 3;
      let retryCount = 0;

      while (retryCount < MAX_RETRIES) {
        try {
          // 使用事务确保原子性
          const result = await this.prisma.$transaction(async (tx) => {
            // 获取账户信息（包含版本号用于乐观锁）
            const account = await tx.practitionerAccount.findUnique({
              where: { practitionerId },
            });

            if (!account) {
              throw new NotFoundException(`Practitioner account not found: ${practitionerId}`);
            }

            // 计算当前可用额度
            const currentAvailableCredit = account.creditLimit.sub(account.usedCredit);
            const totalAvailable = account.balance.add(currentAvailableCredit);
            
            if (totalAvailable.lt(amount)) {
              throw new BadRequestException(
                `余额不足。当前余额: ${account.balance}, 可用额度: ${currentAvailableCredit}, 需要: ${amount}`
              );
            }

            // 计算扣款后的余额和信用
            let newBalance = account.balance;
            let newUsedCredit = account.usedCredit;
            let newAvailableCredit = currentAvailableCredit;

            if (account.balance.gte(amount)) {
              // 余额充足，直接从余额扣除
              newBalance = account.balance.sub(amount);
            } else {
              // 余额不足，先用完余额，再使用额度
              const remainingAmount = amount.sub(account.balance);
              newBalance = new Decimal(0);
              newUsedCredit = account.usedCredit.add(remainingAmount);
              newAvailableCredit = account.creditLimit.sub(newUsedCredit);
            }

            // 使用乐观锁更新账户（检查版本号）
            const updatedAccount = await tx.practitionerAccount.update({
              where: {
                practitionerId,
                version: account.version, // 乐观锁：只有版本匹配才能更新
              },
              data: {
                balance: newBalance,
                usedCredit: newUsedCredit,
                availableCredit: newAvailableCredit,
                version: { increment: 1 }, // 增加版本号
              },
            });

            // 创建交易记录
            const transaction = await tx.accountTransaction.create({
              data: {
                accountId: account.id,
                transactionType: "DEBIT",
                amount: amount,
                balanceBefore: account.balance,
                balanceAfter: newBalance,
                creditBefore: account.usedCredit,
                creditAfter: newUsedCredit,
                referenceType: "ORDER",
                referenceId: orderId,
                description: reason || `Order payment deduction: ${orderId}`,
                createdBy: practitionerId,
              },
            });

            this.logger.log(
              `Successfully deducted ${amount} from practitioner ${practitionerId}. ` +
              `New balance: ${newBalance}, New available credit: ${newAvailableCredit}`
            );

            return transaction;
          }, {
            maxWait: 5000,
            timeout: 10000,
          });

          return result;
        } catch (error) {
          // 处理乐观锁冲突
          if (error.code === 'P2025' || error.code === 'P2034') {
            retryCount++;
            if (retryCount >= MAX_RETRIES) {
              throw new ConflictException(
                `Account update conflict after ${MAX_RETRIES} retries. Please try again.`
              );
            }
            
            // 指数退避重试
            const delay = Math.pow(2, retryCount) * 100;
            await new Promise(resolve => setTimeout(resolve, delay));
            this.logger.warn(
              `Optimistic lock conflict for practitioner ${practitionerId}, retrying (${retryCount}/${MAX_RETRIES})`
            );
            continue;
          }
          
          throw error;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to deduct balance for practitioner ${practitionerId}:`, error);
      
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Failed to deduct balance: ${error.message}`
      );
    }
  }

  /**
   * 向医师账户退款
   * @param practitionerId 医师ID
   * @param amount 退款金额
   * @param orderId 订单ID
   * @param reason 退款原因
   * @returns 交易记录
   */
  async refundBalance(
    practitionerId: string,
    amount: Decimal,
    orderId: string,
    reason?: string
  ): Promise<AccountTransaction> {
    this.logger.log(`Refunding ${amount} to practitioner ${practitionerId} for order ${orderId}`);
    
    try {
      // 输入验证
      if (!practitionerId) {
        throw new BadRequestException("Practitioner ID is required");
      }
      if (!amount || amount.lte(0)) {
        throw new BadRequestException("Amount must be greater than 0");
      }
      if (!orderId) {
        throw new BadRequestException("Order ID is required");
      }

      const MAX_RETRIES = 3;
      let retryCount = 0;

      while (retryCount < MAX_RETRIES) {
        try {
          // 使用事务确保原子性
          const result = await this.prisma.$transaction(async (tx) => {
            // 获取账户信息（包含版本号用于乐观锁）
            const account = await tx.practitionerAccount.findUnique({
              where: { practitionerId },
            });

            if (!account) {
              throw new NotFoundException(`Practitioner account not found: ${practitionerId}`);
            }

            // 计算退款后的余额（退款直接加到余额中）
            const newBalance = account.balance.add(amount);
            const newUsedCredit = account.usedCredit; // 已使用额度保持不变
            const newAvailableCredit = account.creditLimit.sub(newUsedCredit);

            // 使用乐观锁更新账户（检查版本号）
            const updatedAccount = await tx.practitionerAccount.update({
              where: {
                practitionerId,
                version: account.version, // 乐观锁：只有版本匹配才能更新
              },
              data: {
                balance: newBalance,
                version: { increment: 1 }, // 增加版本号
              },
            });

            // 创建交易记录
            const transaction = await tx.accountTransaction.create({
              data: {
                accountId: account.id,
                transactionType: "CREDIT",
                amount: amount,
                balanceBefore: account.balance,
                balanceAfter: newBalance,
                creditBefore: account.usedCredit,
                creditAfter: newUsedCredit,
                referenceType: "ORDER",
                referenceId: orderId,
                description: reason || `Order refund: ${orderId}`,
                createdBy: practitionerId,
              },
            });

            this.logger.log(
              `Successfully refunded ${amount} to practitioner ${practitionerId}. ` +
              `New balance: ${newBalance}`
            );

            return transaction;
          }, {
            maxWait: 5000,
            timeout: 10000,
          });

          return result;
        } catch (error) {
          // 处理乐观锁冲突
          if (error.code === 'P2025' || error.code === 'P2034') {
            retryCount++;
            if (retryCount >= MAX_RETRIES) {
              throw new ConflictException(
                `Account update conflict after ${MAX_RETRIES} retries. Please try again.`
              );
            }
            
            // 指数退避重试
            const delay = Math.pow(2, retryCount) * 100;
            await new Promise(resolve => setTimeout(resolve, delay));
            this.logger.warn(
              `Optimistic lock conflict for practitioner ${practitionerId}, retrying (${retryCount}/${MAX_RETRIES})`
            );
            continue;
          }
          
          throw error;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to refund balance for practitioner ${practitionerId}:`, error);
      
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Failed to refund balance: ${error.message}`
      );
    }
  }

  /**
   * 获取医师账户余额
   * @param practitionerId 医师ID
   * @returns 账户余额信息
   */
  async getBalance(practitionerId: string): Promise<{ 
    balance: Decimal; 
    availableCredit: Decimal; 
    creditLimit: Decimal;
    usedCredit: Decimal;
  }> {
    this.logger.log(`Getting balance for practitioner ${practitionerId}`);
    
    try {
      // 输入验证
      if (!practitionerId) {
        throw new BadRequestException("Practitioner ID is required");
      }

      // 查询账户信息
      const account = await this.prisma.practitionerAccount.findUnique({
        where: { practitionerId },
        select: {
          balance: true,
          availableCredit: true,
          creditLimit: true,
          usedCredit: true,
        },
      });

      if (!account) {
        throw new NotFoundException(`Practitioner account not found: ${practitionerId}`);
      }

      this.logger.debug(
        `Retrieved balance for practitioner ${practitionerId}: ` +
        `balance=${account.balance}, availableCredit=${account.availableCredit}, creditLimit=${account.creditLimit}`
      );

      return {
        balance: account.balance,
        availableCredit: account.availableCredit,
        creditLimit: account.creditLimit,
        usedCredit: account.usedCredit,
      };
    } catch (error) {
      this.logger.error(`Failed to get balance for practitioner ${practitionerId}:`, error);
      
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Failed to get balance: ${error.message}`
      );
    }
  }

  /**
   * 获取医师账户交易历史
   * @param practitionerId 医师ID
   * @param limit 限制数量
   * @param offset 偏移量
   * @returns 交易记录列表
   */
  async getTransactionHistory(
    practitionerId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AccountTransaction[]> {
    this.logger.log(`Getting transaction history for practitioner ${practitionerId}`);
    
    try {
      // 输入验证
      if (!practitionerId) {
        throw new BadRequestException("Practitioner ID is required");
      }
      if (limit <= 0 || limit > 200) {
        throw new BadRequestException("Limit must be between 1 and 200");
      }
      if (offset < 0) {
        throw new BadRequestException("Offset must be >= 0");
      }

      // 首先检查账户是否存在
      const accountExists = await this.accountExists(practitionerId);
      if (!accountExists) {
        throw new NotFoundException(`Practitioner account not found: ${practitionerId}`);
      }

      // 查询交易历史
      const transactions = await this.prisma.accountTransaction.findMany({
        where: {
          account: {
            practitionerId,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      });

      this.logger.debug(
        `Retrieved ${transactions.length} transactions for practitioner ${practitionerId}`
      );

      return transactions;
    } catch (error) {
      this.logger.error(`Failed to get transaction history for practitioner ${practitionerId}:`, error);
      
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Failed to get transaction history: ${error.message}`
      );
    }
  }

  /**
   * 检查账户是否存在
   * @param practitionerId 医师ID
   * @returns 账户是否存在
   */
  async accountExists(practitionerId: string): Promise<boolean> {
    this.logger.debug(`Checking if account exists for practitioner ${practitionerId}`);
    
    try {
      if (!practitionerId) {
        return false;
      }

      const account = await this.prisma.practitionerAccount.findUnique({
        where: { practitionerId },
        select: { id: true },
      });

      return !!account;
    } catch (error) {
      this.logger.error(`Failed to check account existence for practitioner ${practitionerId}:`, error);
      return false;
    }
  }

  /**
   * 获取账户信息（包含版本号用于乐观锁）
   * @param practitionerId 医师ID
   * @returns 完整的账户信息
   */
  async getAccountWithVersion(practitionerId: string): Promise<PractitionerAccount> {
    this.logger.debug(`Getting account with version for practitioner ${practitionerId}`);
    
    try {
      // 输入验证
      if (!practitionerId) {
        throw new BadRequestException("Practitioner ID is required");
      }

      const account = await this.prisma.practitionerAccount.findUnique({
        where: { practitionerId },
      });

      if (!account) {
        throw new NotFoundException(`Practitioner account not found: ${practitionerId}`);
      }

      return account;
    } catch (error) {
      this.logger.error(`Failed to get account with version for practitioner ${practitionerId}:`, error);
      
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Failed to get account with version: ${error.message}`
      );
    }
  }
}
