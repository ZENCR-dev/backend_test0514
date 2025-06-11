import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { User, UserProfile, UserStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10); // Hash密码

    // 创建用户并同时创建用户档案
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        role: createUserDto.role,
        status: "pending", // 默认状态为待审核
        referralCode: createUserDto.referralCode, // 如果有推荐码，则保存
        profile: {
          create: {
            fullName: createUserDto.fullName,
            phone: createUserDto.phone,
            licenseNumber: createUserDto.licenseNumber, // 医生可能有执照号
            address: createUserDto.address,
          },
        },
      },
    });

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  }

  async updateStatus(id: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { status },
    });
  }

  // ... 其他CRUD方法根据需要添加
}
