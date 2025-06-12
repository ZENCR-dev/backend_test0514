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
import { AccountStatus } from "@prisma/client";

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
        where: { id },
        data: {
          ...updateDto,
          updatedAt: new Date(),
        },
        include: {
          clinic: true, // 包含诊所信息
        },
      });

      return this.mapToResponseDto(updatedAccount);
    } catch (error) {
      throw new BadRequestException("更新诊所账户失败");
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    const existingAccount = await this.findOne(id);

    await this.prisma.clinicAccount.update({
      where: { id },
      data: {
        status: AccountStatus.frozen, // 使用frozen状态标记为已删除
        updatedAt: new Date(),
      },
    });

    return { message: "诊所账户删除成功" };
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
}
