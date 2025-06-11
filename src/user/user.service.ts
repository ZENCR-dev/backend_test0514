import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { UserProfileService } from "./services/user-profile.service";
import { UserValidationService } from "./services/user-validation.service";
import {
  CreateUserData,
  FullUserInfo,
  UpdateUserData,
  UserQueryOptions,
  PaginatedUsers,
  UserListQuery,
} from "./interfaces/user.interface";
import { User, UserStatus, Prisma } from "@prisma/client";
import { FindAllUsersDto } from "./dto/find-all-users.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private userProfileService: UserProfileService,
    private userValidationService: UserValidationService,
  ) {}

  /**
   * 创建新用户
   */
  async createUser(data: CreateUserData): Promise<FullUserInfo> {
    await this.userValidationService.validateRegistrationData({
      email: data.email,
      password: data.password,
      role: data.role,
      fullName: data.profile.fullName,
      phone: data.profile.phone,
    });

    const hashedPassword = await this.hashPassword(data.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          role: data.role,
          status: UserStatus.pending, // 默认'pending'，等待管理员审批
          profile: {
            create: {
              fullName: data.profile.fullName,
              phone: data.profile.phone,
              address: data.profile.address,
            },
          },
        },
        include: { profile: true },
      });

      const { password, ...result } = user;
      return result;
    } catch (error) {
      this.handlePrismaError(error, "Failed to create user");
    }
  }

  /**
   * 根据ID查找用户
   */
  async findById(
    id: string,
    options: UserQueryOptions = { includeProfile: true },
  ): Promise<FullUserInfo | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: options.includeProfile,
      },
    });

    if (!user) return null;

    if (!options.includePassword) {
      const { password, ...result } = user;
      return result as FullUserInfo;
    }

    return user as FullUserInfo;
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(
    email: string,
    options: UserQueryOptions = { includeProfile: true },
  ): Promise<FullUserInfo | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        profile: options.includeProfile,
      },
    });

    if (!user) return null;

    if (!options.includePassword) {
      const { password, ...result } = user;
      return result as FullUserInfo;
    }

    return user as FullUserInfo;
  }

  /**
   * 更新用户信息
   */
  async updateUser(id: string, data: UpdateUserData): Promise<FullUserInfo> {
    const existingUser = await this.findById(id);
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userValidationService.validateUpdateData(id, {
      email: data.email,
      fullName: data.profile?.fullName,
      phone: data.profile?.phone,
    });

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          email: data.email,
          status: data.status,
          profile: data.profile ? { update: data.profile } : undefined,
          updatedAt: new Date(),
        },
        include: { profile: true },
      });

      const { password, ...result } = updatedUser;
      return result;
    } catch (error) {
      this.handlePrismaError(error, "Failed to update user");
    }
  }

  /**
   * 删除用户（软删除）
   */
  async softDeleteUser(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.suspended, updatedAt: new Date() },
    });
  }

  /**
   * 永久删除用户
   */
  async hardDeleteUser(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  /**
   * 获取用户列表（分页）
   */
  async getUsers(query: UserListQuery): Promise<PaginatedUsers> {
    const {
      page = 1,
      limit = 10,
      role,
      status,
      search,
      sortBy,
      sortOrder,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { profile: { fullName: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: { profile: true },
        orderBy: sortBy
          ? { [sortBy]: sortOrder || "asc" }
          : { createdAt: "desc" },
      }),
      this.prisma.user.count({ where }),
    ]);

    const usersWithoutPassword = users.map((user) => {
      const { password, ...result } = user;
      return result;
    });

    return {
      users: usersWithoutPassword,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 哈希密码
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12");
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Prisma 错误处理
   */
  private handlePrismaError(error: any, defaultMessage: string) {
    if (error.code === "P2002") {
      // Unique constraint failed
      throw new NotFoundException(
        `${error.meta.target.join(", ")} already exists.`,
      );
    }
    this.logError(error);
    throw new InternalServerErrorException(defaultMessage);
  }

  /**
   * 记录错误
   */
  private logError(error: any) {
    console.error("UserService Error:", error);
  }

  async findAll(query: FindAllUsersDto) {
    const { page = "1", limit = "10", status } = query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const where: Prisma.UserWhereInput = {};
    if (status) {
      where.status = status;
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limitNumber,
        include: { profile: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => {
        const { password, ...result } = user;
        return result;
      }),
      total,
      page: pageNumber,
      limit: limitNumber,
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...result } = user;
    return result as FullUserInfo;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    // In a real app, you would handle password hashing if it's updated
    const user = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
    const { password, ...result } = user;
    return result;
  }

  async remove(id: string) {
    await this.prisma.user.delete({
      where: { id },
    });
    return { message: `User with ID ${id} deleted successfully` };
  }
}
