import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UserRole } from "@prisma/client";

@Injectable()
export class UserValidationService {
  constructor(private prisma: PrismaService) {}

  /**
   * 验证邮箱格式
   */
  validateEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 验证密码强度
   */
  validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }

    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }

    if (!/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证手机号格式（新西兰格式）
   */
  validatePhoneFormat(phone: string): boolean {
    // 新西兰手机号格式：+64 21/22/27/28/29 + 6-8位数字
    const nzMobileRegex = /^(\+64|0)(2[1-9]|21|22|27|28|29)\d{6,8}$/;
    return nzMobileRegex.test(phone.replace(/\s/g, ""));
  }

  /**
   * 检查邮箱是否已被使用
   */
  async isEmailTaken(email: string, excludeUserId?: string): Promise<boolean> {
    const where: any = { email };

    if (excludeUserId) {
      where.id = { not: excludeUserId };
    }

    const existingUser = await this.prisma.user.findFirst({ where });
    return !!existingUser;
  }

  /**
   * 检查用户角色是否有效
   */
  validateUserRole(role: string): boolean {
    return Object.values(UserRole).includes(role as UserRole);
  }

  /**
   * 验证完整用户注册数据
   */
  async validateRegistrationData(data: {
    email: string;
    password: string;
    role: UserRole;
    fullName: string;
    phone?: string;
  }): Promise<void> {
    const errors: string[] = [];

    // 验证邮箱格式
    if (!this.validateEmailFormat(data.email)) {
      errors.push("Invalid email format");
    }

    // 检查邮箱是否已被使用
    if (await this.isEmailTaken(data.email)) {
      errors.push("Email is already in use");
    }

    // 验证密码强度
    const passwordValidation = this.validatePasswordStrength(data.password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }

    // 验证角色
    if (!this.validateUserRole(data.role)) {
      errors.push("Invalid user role");
    }

    // 验证姓名
    if (!data.fullName || data.fullName.trim().length < 2) {
      errors.push("Full name must be at least 2 characters long");
    }

    // 验证手机号（如果提供）
    if (data.phone && !this.validatePhoneFormat(data.phone)) {
      errors.push("Invalid phone number format for New Zealand");
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: "Validation failed",
        errors,
      });
    }
  }

  /**
   * 验证用户更新数据
   */
  async validateUpdateData(
    userId: string,
    data: {
      email?: string;
      fullName?: string;
      phone?: string;
    },
  ): Promise<void> {
    const errors: string[] = [];

    // 验证邮箱（如果提供）
    if (data.email) {
      if (!this.validateEmailFormat(data.email)) {
        errors.push("Invalid email format");
      }

      if (await this.isEmailTaken(data.email, userId)) {
        errors.push("Email is already in use");
      }
    }

    // 验证姓名（如果提供）
    if (data.fullName !== undefined) {
      if (!data.fullName || data.fullName.trim().length < 2) {
        errors.push("Full name must be at least 2 characters long");
      }
    }

    // 验证手机号（如果提供）
    if (data.phone && !this.validatePhoneFormat(data.phone)) {
      errors.push("Invalid phone number format for New Zealand");
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: "Validation failed",
        errors,
      });
    }
  }
}
