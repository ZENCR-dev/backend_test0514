import { User, UserProfile } from "@prisma/client";
import {
  ApiResponseV12,
  AuthResponseDataV12,
  RefreshTokenResult,
} from "../interfaces/auth.interface";

/**
 * 角色名称转换映射
 */
const ROLE_MAPPING = {
  DOCTOR: "doctor",
  PHARMACY_OPERATOR: "pharmacy",
  ADMIN: "admin",
} as const;

/**
 * 转换用户角色为小写格式
 */
export function transformRole(role: string): string {
  return ROLE_MAPPING[role as keyof typeof ROLE_MAPPING] || role.toLowerCase();
}

/**
 * 从用户信息中提取姓名
 */
export function extractUserName(
  user: User & { profile?: UserProfile | null },
): string {
  if (user.profile?.fullName) {
    return user.profile.fullName;
  }
  // 备用方案：从邮箱中提取用户名
  return user.email.split("@")[0];
}

/**
 * 转换为 v1.2 API 响应格式 - 登录响应
 */
export function transformToLoginResponseV12(
  user: User & { profile?: UserProfile | null },
  accessToken: string,
  refreshToken: string,
): ApiResponseV12<AuthResponseDataV12> {
  return {
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: extractUserName(user),
        role: transformRole(user.role),
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * 转换为 v1.2 API 响应格式 - 刷新令牌响应
 */
export function transformToRefreshResponseV12(
  accessToken: string,
  refreshToken?: string,
): ApiResponseV12<{ accessToken: string; refreshToken?: string }> {
  const data: { accessToken: string; refreshToken?: string } = { accessToken };

  if (refreshToken) {
    data.refreshToken = refreshToken;
  }

  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * 创建错误响应
 */
export function createErrorResponseV12(
  code: string,
  message: string,
  details?: any,
): ApiResponseV12<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}
