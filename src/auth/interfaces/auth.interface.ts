import { UserRole } from "@prisma/client";

/**
 * JWT 负载接口
 */
export interface JwtPayload {
  sub: string; // 用户ID
  email: string;
  role: UserRole;
  iat?: number; // 签发时间
  exp?: number; // 过期时间
  iss?: string; // 签发者
  aud?: string; // 受众
}

/**
 * 认证响应接口
 */
export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    profile?: {
      fullName: string;
      phone?: string;
    };
  };
}

/**
 * 认证配置接口
 */
export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptSaltRounds: number;
}

/**
 * 登录结果接口
 */
export interface LoginResult {
  success: boolean;
  user?: AuthResponse["user"];
  accessToken?: string;
  message?: string;
}

/**
 * 注册结果接口
 */
export interface RegisterResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
  message?: string;
}

/**
 * 密码验证结果接口
 */
export interface PasswordValidationResult {
  isValid: boolean;
  user?: {
    id: string;
    email: string;
    role: UserRole;
    status: string;
  };
}
