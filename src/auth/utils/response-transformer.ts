import {
  AuthResponseDataV12,
  ApiResponseV12,
} from "../interfaces/auth.interface";
import { User, UserProfile } from "@prisma/client";

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
  user: User & { profile?: UserProfile | null } | any,
  accessToken: string,
  refreshToken: string,
): ApiResponseV12<AuthResponseDataV12> {
  // 添加防御性检查，确保user对象和必要属性存在
  if (!user) {
    throw new Error("User object is undefined or null");
  }

  if (!user.id || !user.email || user.role === undefined) {
    console.error("Invalid user object structure:", JSON.stringify(user));
    throw new Error("User object is missing required properties (id, email, or role)");
  }

  return {
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: extractUserName(user),
        role: user.role,
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
