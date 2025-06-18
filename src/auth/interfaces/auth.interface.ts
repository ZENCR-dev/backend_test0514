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
  refreshToken?: string;
  message?: string;
}

/**
 * RefreshToken 请求接口
 */
export interface RefreshTokenDto {
  refreshToken: string;
}

/**
 * RefreshToken 响应接口
 */
export interface RefreshTokenResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string; // 可选：如果实现 token 轮换
  message?: string;
}

/**
 * v1.2 API 响应格式接口
 */
export interface ApiResponseV12<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
  meta?: {
    timestamp: string;
  };
}

/**
 * v1.2 认证响应数据接口
 */
export interface AuthResponseDataV12 {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string; // 小写格式
  };
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
