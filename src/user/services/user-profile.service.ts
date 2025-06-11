import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UserProfileInfo, UpdateUserData } from "../interfaces/user.interface";

@Injectable()
export class UserProfileService {
  constructor(private prisma: PrismaService) {}

  /**
   * 根据用户ID获取用户档案
   */
  async getProfileByUserId(userId: string): Promise<UserProfileInfo | null> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    return profile;
  }

  /**
   * 创建用户档案
   */
  async createProfile(
    userId: string,
    profileData: {
      fullName: string;
      phone?: string;
      address?: any;
    },
  ): Promise<UserProfileInfo> {
    const profile = await this.prisma.userProfile.create({
      data: {
        userId,
        ...profileData,
      },
    });

    return profile;
  }

  /**
   * 更新用户档案
   */
  async updateProfile(
    userId: string,
    updateData: UpdateUserData["profile"],
  ): Promise<UserProfileInfo> {
    const existingProfile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!existingProfile) {
      throw new NotFoundException("User profile not found");
    }

    const updatedProfile = await this.prisma.userProfile.update({
      where: { userId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    return updatedProfile;
  }

  /**
   * 删除用户档案
   */
  async deleteProfile(userId: string): Promise<void> {
    const existingProfile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!existingProfile) {
      throw new NotFoundException("User profile not found");
    }

    await this.prisma.userProfile.delete({
      where: { userId },
    });
  }

  /**
   * 检查档案是否存在
   */
  async profileExists(userId: string): Promise<boolean> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    return !!profile;
  }
}
